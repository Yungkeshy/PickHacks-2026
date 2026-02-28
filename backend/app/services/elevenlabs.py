"""
ElevenLabs integration for emergency dispatch audio generation.

When a user triggers "Panic Mode," this module generates a realistic
text-to-speech audio file containing the user's current GPS coordinates
and a pre-formatted distress message suitable for 911 dispatch.
"""

from __future__ import annotations

import logging
from io import BytesIO
from datetime import datetime, timezone

from elevenlabs import ElevenLabs

from ..config import get_settings

logger = logging.getLogger(__name__)


def _build_dispatch_text(latitude: float, longitude: float, user_name: str | None = None) -> str:
    """
    Compose the emergency dispatch script read aloud in the audio file.
    """
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    caller = user_name or "An anonymous SafeWalk user"

    return (
        f"Emergency. This is an automated distress signal from the SafeWalk application. "
        f"{caller} has triggered a panic alert. "
        f"The user's last known coordinates are: "
        f"latitude {latitude:.6f}, longitude {longitude:.6f}. "
        f"Timestamp: {timestamp}. "
        f"Please dispatch emergency services to these coordinates immediately. "
        f"Repeating: latitude {latitude:.6f}, longitude {longitude:.6f}. "
        f"This is an automated message. End of transmission."
    )


async def generate_distress_audio(
    latitude: float,
    longitude: float,
    user_name: str | None = None,
) -> bytes:
    """
    Call the ElevenLabs TTS API and return raw MP3 bytes of the distress message.

    Parameters
    ----------
    latitude, longitude : float
        GPS coordinates of the user at the time of the panic trigger.
    user_name : str or None
        Optional display name to include in the audio.

    Returns
    -------
    bytes
        MP3 audio data.

    Raises
    ------
    RuntimeError
        If the API key is missing or the ElevenLabs call fails.
    """
    settings = get_settings()
    if not settings.elevenlabs_api_key:
        raise RuntimeError("ELEVENLABS_API_KEY is not set")

    script = _build_dispatch_text(latitude, longitude, user_name)
    logger.info("Generating distress audio for coords (%.6f, %.6f)", latitude, longitude)

    client = ElevenLabs(api_key=settings.elevenlabs_api_key)

    audio_iterator = client.text_to_speech.convert(
        voice_id=settings.elevenlabs_voice_id,
        text=script,
        model_id="eleven_multilingual_v2",
    )

    buffer = BytesIO()
    for chunk in audio_iterator:
        buffer.write(chunk)

    audio_bytes = buffer.getvalue()
    if not audio_bytes:
        raise RuntimeError("ElevenLabs returned empty audio")

    logger.info("Generated %d bytes of distress audio", len(audio_bytes))
    return audio_bytes
