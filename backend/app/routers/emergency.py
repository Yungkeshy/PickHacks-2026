"""
Emergency / Panic Mode endpoints.

Provides the "Panic Button" backend: accepts the user's coordinates, generates
a 911-style dispatch audio file via ElevenLabs TTS, and returns it as a
downloadable MP3.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from ..services.elevenlabs import generate_distress_audio

router = APIRouter(prefix="/api/emergency", tags=["emergency"])


class PanicRequest(BaseModel):
    """Payload sent when a user triggers Panic Mode."""

    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    user_name: Optional[str] = Field(
        default=None, description="Display name to include in the dispatch audio"
    )


@router.post("/panic", response_class=Response)
async def trigger_panic(body: PanicRequest):
    """
    Generate an automated 911 dispatch audio file.

    Accepts the user's current GPS coordinates and optional name, calls
    ElevenLabs to synthesise a distress message, and returns the MP3 audio
    as a downloadable file.
    """
    try:
        audio_bytes = await generate_distress_audio(
            latitude=body.latitude,
            longitude=body.longitude,
            user_name=body.user_name,
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": 'attachment; filename="safewalk_distress.mp3"'
        },
    )
