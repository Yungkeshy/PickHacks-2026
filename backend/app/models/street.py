"""
Pydantic models for the **Street** document (graph edge).

A street connects two ``Intersection`` nodes.  It carries both a physical
``distance_m`` (metres) for standard routing and a dynamic ``danger_score``
(0–100) that the Gemini AI engine adjusts in real time.
"""

from datetime import datetime, timezone
from typing import Annotated, Optional

from bson import ObjectId
from pydantic import BaseModel, Field

from ._objectid import PyObjectId


class GeoJSONLineString(BaseModel):
    """GeoJSON LineString geometry for the street's physical path."""

    type: str = "LineString"
    coordinates: list[list[float]] = Field(
        ...,
        min_length=2,
        description="Array of [longitude, latitude] pairs",
    )


class StreetCreate(BaseModel):
    """Payload accepted when creating a new street edge."""

    name: str = Field(..., examples=["5th Avenue"])
    start_intersection_id: str = Field(
        ..., description="ObjectId string of the origin intersection"
    )
    end_intersection_id: str = Field(
        ..., description="ObjectId string of the destination intersection"
    )
    geometry: GeoJSONLineString
    distance_m: float = Field(..., gt=0, description="Physical length in metres")
    base_weight: float = Field(
        default=0.1,
        ge=0.0,
        le=1.0,
        description="Static baseline risk factor (0 = safe, 1 = maximum risk)",
    )
    danger_score: float = Field(
        default=0.0,
        ge=0.0,
        le=100.0,
        description="Dynamic danger score updated by the AI engine",
    )
    bidirectional: bool = Field(
        default=True,
        description="Whether the edge is traversable in both directions",
    )


class Street(StreetCreate):
    """Full street document as persisted in MongoDB."""

    id: Annotated[PyObjectId, Field(alias="_id", default_factory=PyObjectId)]
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
        "json_encoders": {ObjectId: str},
        "json_schema_extra": {
            "example": {
                "_id": "665f1a2b3c4d5e6f7a8b9c0e",
                "name": "5th Avenue",
                "start_intersection_id": "665f1a2b3c4d5e6f7a8b9c0d",
                "end_intersection_id": "665f1a2b3c4d5e6f7a8b9c0f",
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        [-90.2056, 38.6270],
                        [-90.2060, 38.6275],
                    ],
                },
                "distance_m": 132.5,
                "base_weight": 0.1,
                "danger_score": 45.0,
                "bidirectional": True,
                "updated_at": "2026-02-27T12:00:00Z",
            }
        },
    }
