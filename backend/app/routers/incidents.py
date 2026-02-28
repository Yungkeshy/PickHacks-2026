"""
Incident ingestion endpoints — accepts raw incident text, delegates to the
Gemini AI parser, and returns the structured + stored incident document.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from ..database import incidents_collection
from ..services.gemini import ingest_incident

router = APIRouter(prefix="/api/incidents", tags=["incidents"])


class IncidentReport(BaseModel):
    """Request body for reporting a new incident."""

    raw_text: str = Field(
        ...,
        min_length=5,
        examples=["Mugging reported on 5th Ave near Main St"],
    )
    longitude: Optional[float] = None
    latitude: Optional[float] = None


@router.post("")
async def report_incident(body: IncidentReport):
    """
    Ingest an unstructured incident report.

    The text is sent to Google Gemini which extracts the street name,
    severity (1-100), and category.  The resulting structured data is
    persisted and the ``danger_score`` of matching street edges is updated.
    """
    location = None
    if body.longitude is not None and body.latitude is not None:
        location = {
            "type": "Point",
            "coordinates": [body.longitude, body.latitude],
        }

    try:
        doc = await ingest_incident(body.raw_text, location=location)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc))

    return doc


@router.get("")
async def list_incidents(limit: int = 50):
    """Return the most recent incidents, newest first."""
    col = incidents_collection()
    docs = []
    async for doc in col.find().sort("reported_at", -1).limit(limit):
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    return docs
