"""Pydantic models for all NerveCenter OS API request/response payloads.

Every model uses strict typing with sensible defaults so that callers can
submit minimal JSON while the backend fills in safe fallbacks.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ── SafeWalk ────────────────────────────────────────────────────────

class RouteRequest(BaseModel):
    """POST /api/route/safewalk — pedestrian safe-route request."""

    origin: str = Field(..., description="Origin intersection ID or name")
    destination: str = Field(..., description="Destination intersection ID or name")
    ada_required: bool = Field(
        default=False,
        description="When True, bypass edges where is_accessible=False",
    )
    mode: str = Field(
        default="safest",
        description="Routing strategy: 'safest' or 'shortest'",
    )


class RouteResponse(BaseModel):
    """Computed route returned by the Dijkstra engine."""

    path: List[str] = Field(default_factory=list)
    coordinates: List[List[float]] = Field(default_factory=list)
    total_cost: float = 0.0
    mode: str = "safest"
    ada_required: bool = False
    hazards_bypassed: int = 0


# ── FleetVision ─────────────────────────────────────────────────────

class VisionPayload(BaseModel):
    """POST /api/vision/analyze — dashcam image triage request."""

    image_url: Optional[str] = Field(
        default=None,
        description="URL of the image to analyse (or base64 in future)",
    )
    description: str = Field(
        default="",
        description="Free-text description accompanying the image",
    )


class TriageResponse(BaseModel):
    """Structured triage output from the Gemini AI engine."""

    incident_id: str = ""
    status: str = "PENDING"
    hazard_type: str = "Unknown"
    coordinates: Optional[Dict[str, float]] = None
    vision_confidence: float = 0.0
    action_plan: str = ""
    assigned_department: str = ""
    priority: str = "MEDIUM"


# ── CityVoice ───────────────────────────────────────────────────────

class VoiceTranscript(BaseModel):
    """POST /api/voice/intake — 311 voice/text transcript."""

    text: str = Field(..., min_length=3, description="Transcribed or typed report text")
    source: str = Field(default="kiosk", description="Input source: kiosk, phone, asl")
    location: Optional[str] = Field(default=None, description="Reported location string")


class VoiceTriageResponse(BaseModel):
    """Structured output from CityVoice NLP parsing."""

    incident_id: str = ""
    incident_type: str = ""
    location: str = ""
    priority_level: str = "MEDIUM"
    ada_impact: bool = False
    required_action: str = ""
    confidence_score: float = 0.0


# ── Global SOS ──────────────────────────────────────────────────────

class SOSRequest(BaseModel):
    """POST /api/sos/trigger — emergency panic request."""

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    user_name: Optional[str] = Field(default=None, description="Caller display name")


class SOSResponse(BaseModel):
    """Response after SOS protocol activation."""

    status: str = "dispatched"
    dispatch_text: str = ""
    audio_generated: bool = False
    call_initiated: bool = False


# ── CityShield Ledger ───────────────────────────────────────────────

class LedgerEntry(BaseModel):
    """POST /api/ledger/log — immutable ledger record."""

    entry_type: str = Field(
        ...,
        description="RECORD_LOGGED | ALERT_LOGGED | CONTRACT_EXEC",
    )
    description: str = Field(..., description="Human-readable event description")
    source_module: str = Field(..., description="Originating module name")
    data: Optional[Dict[str, Any]] = Field(default=None, description="Arbitrary payload")


class LedgerRecord(BaseModel):
    """Stored ledger entry with hash chain."""

    id: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    entry_type: str = ""
    description: str = ""
    source_module: str = ""
    data: Optional[Dict[str, Any]] = None
    tx_hash: str = ""
    prev_hash: str = ""


# ── Weather ─────────────────────────────────────────────────────────

class WeatherResponse(BaseModel):
    """GET /api/weather/current — live AQI and temperature."""

    aqi: int = 0
    aqi_label: str = "Unknown"
    temp_f: float = 0.0
    temp_c: float = 0.0
    description: str = ""
