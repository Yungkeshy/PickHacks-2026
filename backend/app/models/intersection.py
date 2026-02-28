"""
Pydantic models for the **Intersection** document (graph node).

Each intersection represents a point on the city map — typically the junction
of two or more streets.  Coordinates are stored in GeoJSON Point format so
MongoDB can build a ``2dsphere`` index for proximity queries.
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


class IntersectionCreate(BaseModel):
    """Payload accepted when creating a new intersection."""

    name: str = Field(..., examples=["5th Ave & Main St"])
    location: GeoJSONPoint
    tags: Optional[list[str]] = Field(
        default=None,
        examples=[["well_lit", "campus"]],
        description="Free-form labels describing safety-relevant features",
    )


class Intersection(IntersectionCreate):
    """Full intersection document as persisted in MongoDB."""

    id: Annotated[PyObjectId, Field(alias="_id", default_factory=PyObjectId)]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
        "json_schema_extra": {
            "example": {
                "_id": "665f1a2b3c4d5e6f7a8b9c0d",
                "name": "5th Ave & Main St",
                "location": {
                    "type": "Point",
                    "coordinates": [-90.2056, 38.6270],
                },
                "tags": ["well_lit", "campus"],
                "created_at": "2026-02-27T12:00:00Z",
            }
        },
    }
