"""SafeWalk ADA — Dijkstra shortest/safest path with ADA-aware edge filtering.

When ``ada_required`` is True the algorithm skips every graph edge whose
``is_accessible`` flag is False, guaranteeing that the returned path only
traverses wheelchair-friendly segments.
"""

from __future__ import annotations

import heapq
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Literal, Tuple

from database import intersections_col, streets_col

logger = logging.getLogger(__name__)


@dataclass(order=True)
class _QueueItem:
    cost: float
    node_id: str = field(compare=False)


async def build_adjacency_list(
    mode: Literal["safest", "shortest"] = "safest",
    ada_required: bool = False,
) -> Tuple[Dict[str, List[Tuple[str, float, Dict[str, Any]]]], Dict[str, List[float]], int]:
    """Build an in-memory adjacency list from MongoDB collections.

    Args:
        mode: ``"safest"`` uses ``danger_score``; ``"shortest"`` uses ``distance_m``.
        ada_required: When True, edges with ``is_accessible=False`` are excluded.

    Returns:
        A 3-tuple of ``(adjacency_dict, coords_dict, hazards_bypassed)``.
    """
    adj: Dict[str, List[Tuple[str, float, Dict[str, Any]]]] = {}
    coords: Dict[str, List[float]] = {}
    hazards_bypassed = 0

    async for doc in intersections_col().find():
        nid = str(doc["_id"])
        coords[nid] = doc["location"]["coordinates"]
        adj.setdefault(nid, [])

    async for edge in streets_col().find():
        if ada_required and not edge.get("is_accessible", True):
            hazards_bypassed += 1
            continue

        weight = edge["danger_score"] if mode == "safest" else edge["distance_m"]
        weight = max(weight, 0.01)

        start = edge["start_intersection_id"]
        end = edge["end_intersection_id"]

        adj.setdefault(start, []).append((end, weight, edge))
        if edge.get("bidirectional", True):
            adj.setdefault(end, []).append((start, weight, edge))

    return adj, coords, hazards_bypassed


async def compute_route(
    origin: str,
    destination: str,
    mode: Literal["safest", "shortest"] = "safest",
    ada_required: bool = False,
) -> Dict[str, Any]:
    """Run Dijkstra over the city graph and return the optimal path.

    Args:
        origin: ObjectId hex-string of the start intersection.
        destination: ObjectId hex-string of the end intersection.
        mode: Routing strategy (``"safest"`` | ``"shortest"``).
        ada_required: Exclude non-accessible edges.

    Returns:
        Dict with ``path``, ``coordinates``, ``total_cost``, ``mode``,
        ``ada_required``, and ``hazards_bypassed``.

    Raises:
        ValueError: If a node is missing or no path exists.
    """
    adj, coords, hazards_bypassed = await build_adjacency_list(mode, ada_required)

    if origin not in adj:
        raise ValueError(f"Origin node '{origin}' not found in graph")
    if destination not in adj:
        raise ValueError(f"Destination node '{destination}' not found in graph")

    dist: Dict[str, float] = {origin: 0.0}
    prev: Dict[str, str | None] = {origin: None}
    pq: list[_QueueItem] = [_QueueItem(cost=0.0, node_id=origin)]

    while pq:
        item = heapq.heappop(pq)
        u = item.node_id

        if u == destination:
            break

        if item.cost > dist.get(u, float("inf")):
            continue

        for neighbour, weight, _edge in adj.get(u, []):
            new_cost = dist[u] + weight
            if new_cost < dist.get(neighbour, float("inf")):
                dist[neighbour] = new_cost
                prev[neighbour] = u
                heapq.heappush(pq, _QueueItem(cost=new_cost, node_id=neighbour))

    if destination not in prev:
        raise ValueError(f"No path between '{origin}' and '{destination}'")

    path_ids: list[str] = []
    current: str | None = destination
    while current is not None:
        path_ids.append(current)
        current = prev.get(current)
    path_ids.reverse()

    path_coords = [coords[nid] for nid in path_ids]

    logger.info(
        "Route %s→%s [%s, ada=%s]: cost=%.2f, hops=%d, hazards_bypassed=%d",
        origin[:8], destination[:8], mode, ada_required,
        dist[destination], len(path_ids), hazards_bypassed,
    )

    return {
        "path": path_ids,
        "coordinates": path_coords,
        "total_cost": round(dist[destination], 4),
        "mode": mode,
        "ada_required": ada_required,
        "hazards_bypassed": hazards_bypassed,
    }
