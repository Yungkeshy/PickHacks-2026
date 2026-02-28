"""
Async MongoDB connection layer using Motor.

Provides a single shared ``AsyncIOMotorClient`` and typed accessors for each
collection so the rest of the application never constructs raw collection
references.
"""

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from .config import get_settings

_client: AsyncIOMotorClient | None = None


async def connect_db() -> None:
    """Initialise the Motor client.  Called once at application startup."""
    global _client
    settings = get_settings()
    _client = AsyncIOMotorClient(settings.mongodb_uri)


async def close_db() -> None:
    """Gracefully close the Motor client.  Called at application shutdown."""
    global _client
    if _client is not None:
        _client.close()
        _client = None


def get_database() -> AsyncIOMotorDatabase:
    """Return a handle to the configured database."""
    if _client is None:
        raise RuntimeError("Database client is not initialised. Call connect_db() first.")
    return _client[get_settings().mongodb_db_name]


# ── Collection accessors ────────────────────────────────────────────────

def intersections_collection():
    """Return the *intersections* (graph nodes) collection."""
    return get_database()["intersections"]


def streets_collection():
    """Return the *streets* (graph edges) collection."""
    return get_database()["streets"]


def incidents_collection():
    """Return the *incidents* collection."""
    return get_database()["incidents"]
