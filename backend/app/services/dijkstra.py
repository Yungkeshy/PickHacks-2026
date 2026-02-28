"""
Custom Dijkstra implementation for safety-weighted pedestrian routing.

Two modes are supported:
  * **shortest** — edge weight = ``distance_m``  (standard routing)
  * **safest**   — edge weight = ``danger_score`` (SafeWalk routing)

The algorithm operates over the city graph stored in MongoDB, building an
adjacency list on-the-fly from the ``streets`` collection, then returning the
optimal path as an ordered list of intersection IDs and their coordinates.
"""

from __future__ import annotations

import heapq
from dataclasses import dataclass, field
from typing import Literal

from ..database import intersections_collection, streets_collection


@dataclass(order=True)
class _QueueItem:
    """Priority-queue element; ordered by cumulative cost."""

    cost: float
    node_id: str = field(compare=False)


async def build_adjacency_list(
    mode: Literal["safest", "shortest"] = "safest",
) -> tuple[dict[str, list[tuple[str, float, dict]]], dict[str, list[float]]]:
    """
    Fetch all streets from MongoDB and build an adjacency list.

    Returns
    -------
    adj : dict
        ``{node_id: [(neighbour_id, weight, street_doc), ...]}``
    coords : dict
        ``{node_id: [lng, lat]}`` for every intersection referenced.
    """
    adj: dict[str, list[tuple[str, float, dict]]] = {}
    coords: dict[str, list[float]] = {}

    i_col = intersections_collection()
    async for doc in i_col.find():
        nid = str(doc["_id"])
        coords[nid] = doc["location"]["coordinates"]
        adj.setdefault(nid, [])

    s_col = streets_collection()
    async for edge in s_col.find():
        weight = edge["danger_score"] if mode == "safest" else edge["distance_m"]
        # Ensure non-zero weight so Dijkstra terminates correctly even on 0-danger edges
        weight = max(weight, 0.01)

        start = edge["start_intersection_id"]
        end = edge["end_intersection_id"]

        adj.setdefault(start, []).append((end, weight, edge))
        if edge.get("bidirectional", True):
            adj.setdefault(end, []).append((start, weight, edge))

    return adj, coords


async def dijkstra(
    start_id: str,
    end_id: str,
    mode: Literal["safest", "shortest"] = "safest",
) -> dict:
    """
    Run Dijkstra's algorithm over the city graph.

    Parameters
    ----------
    start_id : str
        ObjectId (hex string) of the origin intersection.
    end_id : str
        ObjectId (hex string) of the destination intersection.
    mode : ``"safest"`` | ``"shortest"``
        Determines which field is used as the edge weight.

    Returns
    -------
    dict
        ``{"path": [...ids], "coordinates": [[lng,lat], ...],
           "total_cost": float, "mode": str}``

    Raises
    ------
    ValueError
        If start or end node is missing from the graph, or no path exists.
    """
    adj, coords = await build_adjacency_list(mode)

    if start_id not in adj:
        raise ValueError(f"Start node {start_id} not found in graph")
    if end_id not in adj:
        raise ValueError(f"End node {end_id} not found in graph")

    dist: dict[str, float] = {start_id: 0.0}
    prev: dict[str, str | None] = {start_id: None}
    pq: list[_QueueItem] = [_QueueItem(cost=0.0, node_id=start_id)]

    while pq:
        item = heapq.heappop(pq)
        u = item.node_id

        if u == end_id:
            break

        if item.cost > dist.get(u, float("inf")):
            continue

        for neighbour, weight, _edge in adj.get(u, []):
            new_cost = dist[u] + weight
            if new_cost < dist.get(neighbour, float("inf")):
                dist[neighbour] = new_cost
                prev[neighbour] = u
                heapq.heappush(pq, _QueueItem(cost=new_cost, node_id=neighbour))

    if end_id not in prev:
        raise ValueError(f"No path exists between {start_id} and {end_id}")

    path_ids: list[str] = []
    current: str | None = end_id
    while current is not None:
        path_ids.append(current)
        current = prev.get(current)
    path_ids.reverse()

    path_coords = [coords[nid] for nid in path_ids]

    return {
        "path": path_ids,
        "coordinates": path_coords,
        "total_cost": round(dist[end_id], 4),
        "mode": mode,
    }
