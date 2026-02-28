"""
Gemini AI integration for incident parsing.

Accepts raw, unstructured incident text (e.g. "Mugging reported on 5th Ave")
and uses Google's Gemini model to extract:
  * the street name involved
  * a severity score (1-100)
  * an incident category

The extracted data is then used to update the ``danger_score`` on matching
street edges in MongoDB.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone

from google import genai

from ..config import get_settings
from ..database import incidents_collection, streets_collection

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are a public-safety NLP engine. Given a raw incident report, extract:
1. "street" — the street name mentioned (string, or null if unclear).
2. "severity" — an integer from 1 (minor) to 100 (critical) estimating danger.
3. "category" — one of: mugging, assault, harassment, vandalism, theft,
   suspicious_activity, traffic, other.

Respond ONLY with a JSON object. No markdown, no explanation.
Example: {"street": "5th Avenue", "severity": 72, "category": "mugging"}
"""


def _get_client() -> genai.Client:
    """Return a configured Gemini client instance."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY is not set")
    return genai.Client(api_key=settings.gemini_api_key)


async def parse_incident(raw_text: str) -> dict:
    """
    Send ``raw_text`` to Gemini and return structured incident data.

    Returns
    -------
    dict
        ``{"street": str|None, "severity": int, "category": str}``
    """
    client = _get_client()
    response = client.models.generate_content(
        model="gemini-2.0-flash",
        contents=f"{_SYSTEM_PROMPT}\n\nIncident report:\n{raw_text}",
    )

    try:
        text = response.text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        parsed = json.loads(text)
    except (json.JSONDecodeError, IndexError) as exc:
        logger.error("Gemini returned unparseable response: %s", response.text)
        raise ValueError(f"Failed to parse Gemini response: {exc}") from exc

    severity = max(1, min(100, int(parsed.get("severity", 50))))
    return {
        "street": parsed.get("street"),
        "severity": severity,
        "category": parsed.get("category", "other"),
    }


async def ingest_incident(raw_text: str, location: dict | None = None) -> dict:
    """
    Full incident pipeline: parse with Gemini, store in MongoDB, and update
    the danger score on any matching street edge.

    Parameters
    ----------
    raw_text : str
        Free-form incident report text.
    location : dict or None
        Optional GeoJSON Point from the reporter.

    Returns
    -------
    dict
        The saved incident document (with ``_id`` as string).
    """
    parsed = await parse_incident(raw_text)

    doc = {
        "raw_text": raw_text,
        "parsed_street": parsed["street"],
        "severity": parsed["severity"],
        "category": parsed["category"],
        "location": location,
        "reported_at": datetime.now(timezone.utc),
        "resolved": False,
    }
    result = await incidents_collection().insert_one(doc)
    doc["_id"] = str(result.inserted_id)

    if parsed["street"]:
        await _update_danger_scores(parsed["street"], parsed["severity"])

    return doc


async def _update_danger_scores(street_name: str, severity: int) -> int:
    """
    Find street edges whose name matches (case-insensitive substring) and
    blend the new severity into their existing ``danger_score``.

    Uses an exponential moving average so that repeated incidents compound
    the score while a single outlier doesn't dominate.

    Returns the number of edges updated.
    """
    s_col = streets_collection()
    cursor = s_col.find({"name": {"$regex": street_name, "$options": "i"}})
    updated = 0

    async for edge in cursor:
        old_score = edge.get("danger_score", 0.0)
        new_score = min(100.0, round(0.6 * old_score + 0.4 * severity, 2))
        await s_col.update_one(
            {"_id": edge["_id"]},
            {
                "$set": {
                    "danger_score": new_score,
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        updated += 1
        logger.info(
            "Updated edge %s danger_score: %.1f → %.1f",
            edge["name"],
            old_score,
            new_score,
        )

    return updated
