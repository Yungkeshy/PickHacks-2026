"""Weather engine — live AQI and temperature from OpenWeatherMap.

Fetches current conditions and air-quality index for the configured
city coordinates (defaults to Rolla, MO).
"""

from __future__ import annotations

import logging
import os
from typing import Dict

import httpx

logger = logging.getLogger(__name__)

_AQI_LABELS = {1: "Good", 2: "Fair", 3: "Moderate", 4: "Poor", 5: "Very Poor"}


async def get_current_weather() -> Dict:
    """Fetch live weather and AQI from OpenWeatherMap.

    Reads ``WEATHER_API_KEY``, ``WEATHER_LAT``, ``WEATHER_LON`` from env.

    Returns:
        Dict with ``aqi``, ``aqi_label``, ``temp_f``, ``temp_c``,
        and ``description``.  Returns safe fallback values on failure.
    """
    api_key = os.getenv("WEATHER_API_KEY", "")
    lat = os.getenv("WEATHER_LAT", "37.9514")
    lon = os.getenv("WEATHER_LON", "-91.7713")

    fallback = {
        "aqi": 42,
        "aqi_label": "Good",
        "temp_f": 68.0,
        "temp_c": 20.0,
        "description": "Fallback data — set WEATHER_API_KEY for live results",
    }

    if not api_key:
        logger.warning("WEATHER_API_KEY not set — returning fallback data.")
        return fallback

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            weather_resp = await client.get(
                "https://api.openweathermap.org/data/2.5/weather",
                params={"lat": lat, "lon": lon, "appid": api_key, "units": "imperial"},
            )
            weather_resp.raise_for_status()
            w = weather_resp.json()

            aqi_resp = await client.get(
                "http://api.openweathermap.org/data/2.5/air_pollution",
                params={"lat": lat, "lon": lon, "appid": api_key},
            )
            aqi_resp.raise_for_status()
            a = aqi_resp.json()

        temp_f = w.get("main", {}).get("temp", 68.0)
        temp_c = round((temp_f - 32) * 5 / 9, 1)
        aqi_index = a.get("list", [{}])[0].get("main", {}).get("aqi", 1)
        desc = w.get("weather", [{}])[0].get("description", "clear sky").title()

        return {
            "aqi": aqi_index * 20,
            "aqi_label": _AQI_LABELS.get(aqi_index, "Unknown"),
            "temp_f": round(temp_f, 1),
            "temp_c": temp_c,
            "description": desc,
        }

    except Exception as exc:
        logger.error("Weather fetch failed: %s", exc)
        return fallback
