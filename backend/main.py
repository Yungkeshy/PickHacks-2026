"""NerveCenter OS — FastAPI application entry point.

Assembles all API endpoints, CORS middleware, and the async MongoDB
lifecycle.  Run with:

    uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from database import close_db, connect_db
from models import (
    LedgerEntry,
    LedgerRecord,
    RouteRequest,
    RouteResponse,
    SOSRequest,
    SOSResponse,
    TriageResponse,
    VisionPayload,
    VoiceTranscript,
    VoiceTriageResponse,
    WeatherResponse,
)

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(name)s | %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Connect to MongoDB on startup, disconnect on shutdown."""
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="NerveCenter OS API",
    description="Smart City System-of-Systems backend",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ──────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    """Liveness probe."""
    return {"status": "ok", "service": "NerveCenter OS"}


# ── SafeWalk ADA Routing ───────────────────────────────────────────

@app.post("/api/route/safewalk", response_model=RouteResponse)
async def route_safewalk(body: RouteRequest):
    """Compute a Dijkstra-optimised pedestrian route.

    When ``ada_required`` is True, non-accessible edges are excluded
    from the graph before pathfinding.
    """
    from engines.dijkstra import compute_route

    try:
        result = await compute_route(
            origin=body.origin,
            destination=body.destination,
            mode=body.mode,
            ada_required=body.ada_required,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("Route computation failed: %s", exc)
        raise HTTPException(status_code=500, detail="Route computation failed")


# ── SafeWalk Graph Data ────────────────────────────────────────────

@app.get("/api/route/intersections")
async def list_intersections():
    """Return all intersections (graph nodes) for map rendering."""
    from database import intersections_col

    docs = []
    async for doc in intersections_col().find():
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    return docs


@app.get("/api/route/streets")
async def list_streets():
    """Return all streets (graph edges) with danger scores and accessibility."""
    from database import streets_col

    docs = []
    async for doc in streets_col().find():
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    return docs


# ── FleetVision Analyze ────────────────────────────────────────────

@app.post("/api/vision/analyze", response_model=TriageResponse)
async def vision_analyze(body: VisionPayload):
    """Run AI triage on a dashcam image or description.

    Calls Gemini for structured triage and SAM 3 (stub) for segmentation.
    """
    from engines.ai_triage import sam3_segment, triage_vision

    try:
        triage = await triage_vision(body.description or "Dashcam capture of a city street")
        if body.image_url:
            triage["sam3_result"] = await sam3_segment(body.image_url)
        return triage
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


# ── CityVoice Intake ──────────────────────────────────────────────

@app.post("/api/voice/intake", response_model=VoiceTriageResponse)
async def voice_intake(body: VoiceTranscript):
    """Parse a 311 voice or text transcript into structured dispatch data."""
    from engines.ai_triage import triage_voice

    try:
        result = await triage_voice(body.text, location=body.location)
        return result
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


# ── Global SOS ─────────────────────────────────────────────────────

@app.post("/api/sos/trigger", response_model=SOSResponse)
async def sos_trigger(body: SOSRequest):
    """Activate the Global SOS protocol.

    Generates ElevenLabs TTS audio and initiates a Twilio emergency call.
    Also logs the event to the CityShield ledger.
    """
    from engines.blockchain import log_entry
    from engines.communications import generate_tts_audio, initiate_emergency_call

    dispatch_text = ""
    audio_ok = False
    call_ok = False

    try:
        audio_bytes = await generate_tts_audio(
            body.latitude, body.longitude, body.user_name,
        )
        audio_ok = True
    except RuntimeError as exc:
        logger.warning("SOS TTS failed: %s", exc)

    try:
        call_result = await initiate_emergency_call(
            body.latitude, body.longitude, body.user_name,
        )
        dispatch_text = call_result.get("dispatch_text", "")
        call_ok = call_result.get("status") == "initiated"
    except Exception as exc:
        logger.warning("SOS call failed: %s", exc)

    await log_entry(
        entry_type="ALERT_LOGGED",
        description=f"SOS triggered at ({body.latitude:.6f}, {body.longitude:.6f})",
        source_module="GlobalSOS",
        data={"latitude": body.latitude, "longitude": body.longitude},
    )

    return SOSResponse(
        status="dispatched",
        dispatch_text=dispatch_text,
        audio_generated=audio_ok,
        call_initiated=call_ok,
    )


# ── CityShield Ledger ─────────────────────────────────────────────

@app.post("/api/ledger/log")
async def ledger_log(body: LedgerEntry):
    """Append an immutable record to the CityShield ledger."""
    from engines.blockchain import log_entry

    try:
        record = await log_entry(
            entry_type=body.entry_type,
            description=body.description,
            source_module=body.source_module,
            data=body.data,
        )
        return record
    except Exception as exc:
        logger.error("Ledger write failed: %s", exc)
        raise HTTPException(status_code=500, detail="Ledger write failed")


@app.get("/api/ledger/entries")
async def ledger_entries(limit: int = 50):
    """Retrieve the most recent CityShield ledger entries."""
    from engines.blockchain import get_entries

    return await get_entries(limit=limit)


# ── Weather ────────────────────────────────────────────────────────

@app.get("/api/weather/current", response_model=WeatherResponse)
async def weather_current():
    """Fetch live AQI and temperature from OpenWeatherMap."""
    from engines.weather import get_current_weather

    return await get_current_weather()
