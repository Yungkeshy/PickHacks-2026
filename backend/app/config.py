"""
Application configuration loaded from environment variables.

All secrets and connection strings are read from the environment (or a .env
file) via Pydantic Settings so that nothing is hard-coded.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Central configuration object for the SafeWalk backend."""

    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db_name: str = "safewalk"

    # Google Gemini
    gemini_api_key: str = ""

    # ElevenLabs
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = "21m00Tcm4TlvDq8ikWAM"  # default "Rachel"

    # Auth0 (validated on the frontend; backend may verify JWTs)
    auth0_domain: str = ""
    auth0_audience: str = ""

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache()
def get_settings() -> Settings:
    """Return a cached Settings singleton."""
    return Settings()
