"""
Routing endpoints — exposes the Dijkstra-based safe-route calculation
and graph inspection helpers.
"""

from __future__ import annotations

from typing import Literal, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query

from ..database import intersections_collection, streets_collection
from ..services.dijkstra import dijkstra

router = APIRouter(prefix="/api/route", tags=["routing"])


@router.get("")
async def get_safe_route(
    start: str = Query(..., description="Origin intersection ObjectId"),
    end: str = Query(..., description="Destination intersection ObjectId"),
    mode: Literal["safest", "shortest"] = Query(
        "safest", description="Routing strategy"
    ),
):
    """
    Compute the optimal pedestrian route between two intersections.

    Query params
    ------------
    start : ObjectId hex string
    end   : ObjectId hex string
    mode  : ``safest`` (default) or ``shortest``

    Returns the ordered list of intersection coordinates to draw on the map,
    the total path cost, and the routing mode used.
    """
    if not ObjectId.is_valid(start) or not ObjectId.is_valid(end):
        raise HTTPException(status_code=400, detail="Invalid ObjectId format")

    try:
        result = await dijkstra(start, end, mode=mode)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))

    return result


@router.get("/intersections")
async def list_intersections():
    """Return all intersections (graph nodes) for map rendering."""
    col = intersections_collection()
    docs = []
    async for doc in col.find():
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    return docs


@router.get("/streets")
async def list_streets():
    """Return all streets (graph edges) with current danger scores."""
    col = streets_collection()
    docs = []
    async for doc in col.find():
        doc["_id"] = str(doc["_id"])
        docs.append(doc)
    return docs


@router.get("/nearest")
async def nearest_intersection(
    lng: float = Query(..., description="Longitude"),
    lat: float = Query(..., description="Latitude"),
):
    """
    Find the intersection closest to a given coordinate pair.

    Uses MongoDB's ``$nearSphere`` with a ``2dsphere`` index on the
    ``location`` field.
    """
    col = intersections_collection()
    doc = await col.find_one(
        {
            "location": {
                "$nearSphere": {
                    "$geometry": {"type": "Point", "coordinates": [lng, lat]},
                }
            }
        }
    )
    if doc is None:
        raise HTTPException(status_code=404, detail="No intersections found")
    doc["_id"] = str(doc["_id"])
    return doc
