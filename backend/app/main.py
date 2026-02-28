"""
SafeWalk — FastAPI application entry point.

Registers routers, CORS middleware, and the MongoDB lifecycle hooks.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import close_db, connect_db
from .routers import emergency, incidents, routing


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup / shutdown resources."""
    await connect_db()
    yield
    await close_db()


app = FastAPI(
    title="SafeWalk API",
    description="Real-time safety-weighted pedestrian routing",
    version="0.1.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(routing.router)
app.include_router(incidents.router)
app.include_router(emergency.router)


@app.get("/health")
async def health_check():
    """Simple liveness probe."""
    return {"status": "ok"}
