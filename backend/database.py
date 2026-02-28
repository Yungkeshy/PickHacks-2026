"""Async MongoDB Atlas connection layer using Motor.

Provides a singleton ``AsyncIOMotorClient`` and typed collection accessors
so that every module in the application shares a single connection pool.
"""

from __future__ import annotations

import os
import logging
from typing import Optional

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

_client: Optional[AsyncIOMotorClient] = None
_db: Optional[AsyncIOMotorDatabase] = None


async def connect_db() -> None:
    """Initialise the Motor client and select the database.

    Reads ``MONGO_URI`` from the environment.  Falls back to a local
    MongoDB instance when the variable is absent.
    """
    global _client, _db
    uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    _client = AsyncIOMotorClient(uri)
    _db = _client.get_default_database("nervecenter")
    logger.info("Connected to MongoDB: %s", uri.split("@")[-1] if "@" in uri else uri)


async def close_db() -> None:
    """Gracefully close the Motor client at shutdown."""
    global _client, _db
    if _client is not None:
        _client.close()
        _client = None
        _db = None
        logger.info("MongoDB connection closed.")


def get_database() -> AsyncIOMotorDatabase:
    """Return a handle to the configured database."""
    if _db is None:
        raise RuntimeError("Database not initialised — call connect_db() first.")
    return _db


# ── Collection accessors ────────────────────────────────────────────

def intersections_col():
    """Graph nodes (intersections)."""
    return get_database()["intersections"]


def streets_col():
    """Graph edges (streets) with ``danger_score`` and ``is_accessible``."""
    return get_database()["streets"]


def incidents_col():
    """Incident reports parsed by Gemini."""
    return get_database()["incidents"]


def detections_col():
    """FleetVision image detections."""
    return get_database()["detections"]


def tickets_col():
    """CityVoice dispatch tickets."""
    return get_database()["tickets"]


def ledger_col():
    """CityShield immutable ledger entries."""
    return get_database()["ledger"]
