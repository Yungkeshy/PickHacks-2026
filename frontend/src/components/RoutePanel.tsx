"use client";

import { useState } from "react";
import type { Intersection, RouteResult } from "@/lib/api";
import { fetchRoute } from "@/lib/api";

interface Props {
  intersections: Intersection[];
  startId: string | null;
  endId: string | null;
  onStartChange: (id: string) => void;
  onEndChange: (id: string) => void;
  onRouteResult: (result: RouteResult | null) => void;
}

export default function RoutePanel({
  intersections,
  startId,
  endId,
  onStartChange,
  onEndChange,
  onRouteResult,
}: Props) {
  const [mode, setMode] = useState<"safest" | "shortest">("safest");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCalculate() {
    if (!startId || !endId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await fetchRoute(startId, endId, mode);
      onRouteResult(result);
    } catch (err: any) {
      setError(err.message);
      onRouteResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-emerald-400">Route Planner</h2>

      <label className="flex flex-col gap-1 text-sm">
        Origin
        <select
          value={startId ?? ""}
          onChange={(e) => onStartChange(e.target.value)}
          className="rounded-md bg-[#1e1e2f] border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Select start…</option>
          {intersections.map((n) => (
            <option key={n._id} value={n._id}>
              {n.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Destination
        <select
          value={endId ?? ""}
          onChange={(e) => onEndChange(e.target.value)}
          className="rounded-md bg-[#1e1e2f] border border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Select end…</option>
          {intersections.map((n) => (
            <option key={n._id} value={n._id}>
              {n.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-2">
        <button
          onClick={() => setMode("safest")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === "safest"
              ? "bg-emerald-600 text-white"
              : "bg-[#1e1e2f] text-gray-400 hover:text-white"
          }`}
        >
          Safest
        </button>
        <button
          onClick={() => setMode("shortest")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${
            mode === "shortest"
              ? "bg-blue-600 text-white"
              : "bg-[#1e1e2f] text-gray-400 hover:text-white"
          }`}
        >
          Shortest
        </button>
      </div>

      <button
        onClick={handleCalculate}
        disabled={!startId || !endId || loading}
        className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Calculating…" : "Find Route"}
      </button>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
