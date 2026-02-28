/**
 * Typed fetch helpers for the SafeWalk FastAPI backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/* ── Types ─────────────────────────────────────────────────────────── */

export interface Intersection {
  _id: string;
  name: string;
  location: { type: string; coordinates: [number, number] };
  tags?: string[];
}

export interface RouteResult {
  path: string[];
  coordinates: [number, number][];
  total_cost: number;
  mode: string;
}

export interface Street {
  _id: string;
  name: string;
  start_intersection_id: string;
  end_intersection_id: string;
  geometry: { type: string; coordinates: [number, number][] };
  distance_m: number;
  danger_score: number;
}

export interface IncidentDoc {
  _id: string;
  raw_text: string;
  parsed_street: string | null;
  severity: number;
  category: string | null;
  reported_at: string;
  resolved: boolean;
}

/* ── API calls ─────────────────────────────────────────────────────── */

export function fetchIntersections(): Promise<Intersection[]> {
  return request("/api/route/intersections");
}

export function fetchStreets(): Promise<Street[]> {
  return request("/api/route/streets");
}

export function fetchRoute(
  startId: string,
  endId: string,
  mode: "safest" | "shortest" = "safest"
): Promise<RouteResult> {
  return request(`/api/route?start=${startId}&end=${endId}&mode=${mode}`);
}

export function fetchNearestIntersection(
  lng: number,
  lat: number
): Promise<Intersection> {
  return request(`/api/route/nearest?lng=${lng}&lat=${lat}`);
}

export function reportIncident(
  rawText: string,
  coords?: { longitude: number; latitude: number }
): Promise<IncidentDoc> {
  return request("/api/incidents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text: rawText, ...coords }),
  });
}

export function fetchIncidents(limit = 50): Promise<IncidentDoc[]> {
  return request(`/api/incidents?limit=${limit}`);
}

export async function triggerPanic(
  latitude: number,
  longitude: number,
  userName?: string
): Promise<Blob> {
  const res = await fetch(`${API_BASE}/api/emergency/panic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ latitude, longitude, user_name: userName }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.blob();
}
