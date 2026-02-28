"""
Seed script — populates MongoDB with a small demo graph for Rolla, MO
(Missouri S&T campus area) so the application has data to route against
immediately after deployment.

Usage:
    python -m app.seed
"""

import asyncio
from datetime import datetime, timezone

from .database import connect_db, intersections_collection, streets_collection


INTERSECTIONS = [
    {
        "name": "Pine St & Rolla St",
        "location": {"type": "Point", "coordinates": [-91.7713, 37.9554]},
        "tags": ["campus", "well_lit"],
    },
    {
        "name": "Pine St & State St",
        "location": {"type": "Point", "coordinates": [-91.7743, 37.9554]},
        "tags": ["campus"],
    },
    {
        "name": "10th St & Pine St",
        "location": {"type": "Point", "coordinates": [-91.7713, 37.9530]},
        "tags": ["well_lit"],
    },
    {
        "name": "10th St & State St",
        "location": {"type": "Point", "coordinates": [-91.7743, 37.9530]},
        "tags": [],
    },
    {
        "name": "12th St & Pine St",
        "location": {"type": "Point", "coordinates": [-91.7713, 37.9505]},
        "tags": ["residential"],
    },
    {
        "name": "12th St & State St",
        "location": {"type": "Point", "coordinates": [-91.7743, 37.9505]},
        "tags": ["residential", "dimly_lit"],
    },
]


async def _seed() -> None:
    await connect_db()
    i_col = intersections_collection()
    s_col = streets_collection()

    await i_col.drop()
    await s_col.drop()

    now = datetime.now(timezone.utc)
    for doc in INTERSECTIONS:
        doc["created_at"] = now
    result = await i_col.insert_many(INTERSECTIONS)
    ids = result.inserted_ids

    def _edge(name: str, a: int, b: int, dist: float, danger: float = 0.0):
        return {
            "name": name,
            "start_intersection_id": str(ids[a]),
            "end_intersection_id": str(ids[b]),
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    INTERSECTIONS[a]["location"]["coordinates"],
                    INTERSECTIONS[b]["location"]["coordinates"],
                ],
            },
            "distance_m": dist,
            "base_weight": 0.1,
            "danger_score": danger,
            "bidirectional": True,
            "updated_at": now,
        }

    streets = [
        _edge("Pine St (Rolla→State)", 0, 1, 280.0, 5.0),
        _edge("Rolla St (Pine→10th)", 0, 2, 270.0, 10.0),
        _edge("State St (Pine→10th)", 1, 3, 270.0, 15.0),
        _edge("10th St (Rolla→State)", 2, 3, 280.0, 8.0),
        _edge("Rolla St (10th→12th)", 2, 4, 280.0, 20.0),
        _edge("State St (10th→12th)", 3, 5, 280.0, 65.0),
        _edge("12th St (Pine→State)", 4, 5, 280.0, 40.0),
    ]
    await s_col.insert_many(streets)

    await i_col.create_index([("location", "2dsphere")])
    await s_col.create_index("start_intersection_id")
    await s_col.create_index("end_intersection_id")

    print(f"Seeded {len(INTERSECTIONS)} intersections and {len(streets)} streets.")


if __name__ == "__main__":
    asyncio.run(_seed())
