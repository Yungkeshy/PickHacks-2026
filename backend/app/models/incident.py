"""
Pydantic models for the **Incident** document.

Incidents are ingested as raw text, parsed by the Gemini AI engine, and used
to adjust ``danger_score`` values on nearby street edges.
"""

from datetime import datetime, timezone
from typing import Annotated, Optional

from bson import ObjectId
from pydantic import BaseModel, Field

from ._objectid import PyObjectId


class GeoJSONPoint(BaseModel):
    """GeoJSON Point geometry — ``[longitude, latitude]``."""

    type: str = "Point"
    coordinates: list[float] = Field(
        ...,
        min_length=2,
        max_length=2,
        description="[longitude, latitude]",
    )


class IncidentCreate(BaseModel):
    """Payload accepted when reporting a new incident."""

    raw_text: str = Field(
        ...,
        min_length=5,
        examples=["Mugging reported on 5th Ave near Main St"],
    )
    location: Optional[GeoJSONPoint] = Field(
        default=None,
        description="Optional reporter-supplied coordinates",
    )


class Incident(BaseModel):
    """Full incident document as persisted in MongoDB after AI parsing."""

    id: Annotated[PyObjectId, Field(alias="_id", default_factory=PyObjectId)]
    raw_text: str
    parsed_street: Optional[str] = Field(
        default=None,
        description="Street name extracted by Gemini",
    )
    severity: int = Field(
        default=0,
        ge=0,
        le=100,
        description="AI-assessed severity score (1-100)",
    )
    category: Optional[str] = Field(
        default=None,
        examples=["mugging", "assault", "harassment", "vandalism"],
    )
    location: Optional[GeoJSONPoint] = None
    reported_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved: bool = False

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
        "json_schema_extra": {
            "example": {
                "_id": "665f1a2b3c4d5e6f7a8b9c10",
                "raw_text": "Mugging reported on 5th Ave near Main St",
                "parsed_street": "5th Avenue",
                "severity": 72,
                "category": "mugging",
                "location": {
                    "type": "Point",
                    "coordinates": [-90.2058, 38.6272],
                },
                "reported_at": "2026-02-27T08:30:00Z",
                "resolved": False,
            }
        },
    }
