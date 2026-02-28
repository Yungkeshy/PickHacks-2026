"""Global SOS — ElevenLabs TTS and Twilio emergency dispatch.

Orchestrates the panic-button workflow:
1. Generate a spoken distress message via ElevenLabs TTS.
2. Initiate an emergency phone call via Twilio with the TTS audio.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from io import BytesIO
from typing import Optional

logger = logging.getLogger(__name__)


def _build_dispatch_text(
    latitude: float,
    longitude: float,
    user_name: Optional[str] = None,
) -> str:
    """Compose the emergency dispatch script for TTS.

    Args:
        latitude: GPS latitude of the caller.
        longitude: GPS longitude of the caller.
        user_name: Optional display name.

    Returns:
        Formatted dispatch string.
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    caller = user_name or "An anonymous NerveCenter user"
    return (
        f"Emergency. Automated distress signal from NerveCenter OS. "
        f"{caller} has triggered a panic alert. "
        f"Last known coordinates: latitude {latitude:.6f}, longitude {longitude:.6f}. "
        f"Timestamp: {timestamp}. "
        f"Dispatch emergency services immediately. "
        f"Repeating: latitude {latitude:.6f}, longitude {longitude:.6f}. "
        f"End of transmission."
    )


async def generate_tts_audio(
    latitude: float,
    longitude: float,
    user_name: Optional[str] = None,
) -> bytes:
    """Generate MP3 distress audio via ElevenLabs TTS.

    Args:
        latitude: Caller latitude.
        longitude: Caller longitude.
        user_name: Optional caller name.

    Returns:
        Raw MP3 bytes.

    Raises:
        RuntimeError: If the API key is missing or the call fails.
    """
    api_key = os.getenv("ELEVENLABS_API_KEY", "")
    voice_id = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")

    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set")

    from elevenlabs import ElevenLabs

    script = _build_dispatch_text(latitude, longitude, user_name)
    logger.info("Generating SOS TTS for (%.6f, %.6f)", latitude, longitude)

    client = ElevenLabs(api_key=api_key)
    audio_iter = client.text_to_speech.convert(
        voice_id=voice_id,
        text=script,
        model_id="eleven_multilingual_v2",
    )

    buf = BytesIO()
    for chunk in audio_iter:
        buf.write(chunk)

    audio_bytes = buf.getvalue()
    if not audio_bytes:
        raise RuntimeError("ElevenLabs returned empty audio")

    logger.info("Generated %d bytes of SOS audio", len(audio_bytes))
    return audio_bytes


async def initiate_emergency_call(
    latitude: float,
    longitude: float,
    user_name: Optional[str] = None,
) -> dict:
    """Place an automated emergency call via Twilio.

    Uses Twilio's TwiML ``<Say>`` verb to read the dispatch text.
    Falls back gracefully when credentials are absent.

    Args:
        latitude: Caller latitude.
        longitude: Caller longitude.
        user_name: Optional caller name.

    Returns:
        Dict with call status and SID (or error info).
    """
    account_sid = os.getenv("TWILIO_ACCOUNT_SID", "")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN", "")
    from_number = os.getenv("TWILIO_FROM_NUMBER", "")
    to_number = os.getenv("TWILIO_TO_NUMBER", "")

    if not all([account_sid, auth_token, from_number, to_number]):
        logger.warning("Twilio credentials incomplete — skipping call.")
        return {
            "status": "skipped",
            "reason": "Twilio credentials not configured",
            "dispatch_text": _build_dispatch_text(latitude, longitude, user_name),
        }

    try:
        from twilio.rest import Client

        client = Client(account_sid, auth_token)
        script = _build_dispatch_text(latitude, longitude, user_name)
        twiml = f'<Response><Say voice="alice">{script}</Say></Response>'

        call = client.calls.create(
            twiml=twiml,
            to=to_number,
            from_=from_number,
        )

        logger.info("Twilio call initiated: SID=%s", call.sid)
        return {"status": "initiated", "call_sid": call.sid, "dispatch_text": script}

    except Exception as exc:
        logger.error("Twilio call failed: %s", exc)
        return {"status": "failed", "error": str(exc)}
