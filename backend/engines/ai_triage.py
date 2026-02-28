"""FleetVision & CityVoice — AI triage via Google Gemini.

Provides two entry-points:

* ``triage_text`` — accepts free-form incident text and returns structured
  JSON with incident type, severity, department, etc.
* ``triage_vision`` — stub for Meta SAM 3 image segmentation (placeholder
  until a hosted SAM endpoint is available).
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Any, Dict

from google import genai

logger = logging.getLogger(__name__)

# ── Gemini prompts ──────────────────────────────────────────────────

_VISION_SYSTEM_PROMPT = """\
You are a computer-vision triage engine for a Smart City. Given a description
of a dashcam image, produce a JSON object with exactly these keys:
  "incident_id": a unique string (e.g. "FV-<4 digits>-ADA"),
  "status": one of CRITICAL_VIOLATION | WARNING | INFO,
  "hazard_type": short label,
  "coordinates": {"lat": <float>, "lng": <float>} or null,
  "vision_confidence": float 0-1,
  "action_plan": one-sentence recommendation,
  "assigned_department": department name,
  "priority": HIGH | MEDIUM | LOW
Respond ONLY with valid JSON. No markdown fences, no explanation.
"""

_VOICE_SYSTEM_PROMPT = """\
You are a 311 municipal NLP engine. Given a citizen report transcript,
produce a JSON object with exactly these keys:
  "incident_id": a unique string (e.g. "VOICE-<3 digits>-<TYPE>"),
  "incident_type": category label,
  "location": street or intersection described,
  "priority_level": HIGH | MEDIUM | LOW,
  "ada_impact": boolean,
  "required_action": recommended dispatch action,
  "confidence_score": float 0-1
Respond ONLY with valid JSON. No markdown fences, no explanation.
"""


def _get_client() -> genai.Client:
    """Return a configured Gemini client."""
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=api_key)


def _parse_json_response(text: str) -> Dict[str, Any]:
    """Strip optional markdown fences and parse JSON."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1].rsplit("```", 1)[0].strip()
    return json.loads(cleaned)


# ── Public API ──────────────────────────────────────────────────────

async def triage_vision(description: str) -> Dict[str, Any]:
    """Send an image description to Gemini and return structured triage data.

    Args:
        description: Free-text description of what the dashcam captured.

    Returns:
        Dict matching the ``TriageResponse`` schema.

    Raises:
        RuntimeError: If the API key is missing.
        ValueError: If Gemini returns unparseable output.
    """
    client = _get_client()
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=f"{_VISION_SYSTEM_PROMPT}\n\nImage description:\n{description}",
    )

    try:
        parsed = _parse_json_response(response.text)
    except (json.JSONDecodeError, IndexError) as exc:
        logger.error("Gemini vision response unparseable: %s", response.text)
        raise ValueError(f"Failed to parse Gemini response: {exc}") from exc

    logger.info("FleetVision triage: %s — %s", parsed.get("hazard_type"), parsed.get("status"))
    return parsed


async def triage_voice(transcript: str, location: str | None = None) -> Dict[str, Any]:
    """Parse a 311 voice transcript into structured dispatch data.

    Args:
        transcript: The citizen's report text.
        location: Optional location hint to improve accuracy.

    Returns:
        Dict matching the ``VoiceTriageResponse`` schema.
    """
    client = _get_client()
    prompt = f"{_VOICE_SYSTEM_PROMPT}\n\nTranscript:\n{transcript}"
    if location:
        prompt += f"\nReported location: {location}"

    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=prompt,
    )

    try:
        parsed = _parse_json_response(response.text)
    except (json.JSONDecodeError, IndexError) as exc:
        logger.error("Gemini voice response unparseable: %s", response.text)
        raise ValueError(f"Failed to parse Gemini response: {exc}") from exc

    logger.info("CityVoice triage: %s — %s", parsed.get("incident_type"), parsed.get("priority_level"))
    return parsed


async def sam3_segment(image_url: str) -> Dict[str, Any]:
    """Placeholder for Meta SAM 3 segmentation.

    In production this would call a hosted SAM 3 inference endpoint.
    Currently returns a simulated bounding-box result.

    Args:
        image_url: Public URL of the image to segment.

    Returns:
        Simulated segmentation result with bounding box and label.
    """
    logger.info("SAM3 stub called for: %s", image_url)
    return {
        "model": "SAM3 (stub)",
        "segments": [
            {
                "label": "ADA_OBSTRUCTION",
                "confidence": 0.984,
                "bbox": {"x": 120, "y": 80, "width": 192, "height": 128},
            }
        ],
        "processing_time_ms": 340,
    }
