"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  fetchIntersections,
  fetchNearestIntersection,
  fetchStreets,
  type Intersection,
  type RouteResult,
  type Street,
} from "@/lib/api";
import RoutePanel from "@/components/RoutePanel";
import PanicButton from "@/components/PanicButton";
import IncidentForm from "@/components/IncidentForm";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function Home() {
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [streets, setStreets] = useState<Street[]>([]);
  const [startId, setStartId] = useState<string | null>(null);
  const [endId, setEndId] = useState<string | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [clickMode, setClickMode] = useState<"start" | "end">("start");

  const loadGraph = useCallback(async () => {
    try {
      const [nodes, edges] = await Promise.all([
        fetchIntersections(),
        fetchStreets(),
      ]);
      setIntersections(nodes);
      setStreets(edges);
    } catch {
      /* API may be offline during dev */
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  async function handleMapClick(lat: number, lng: number) {
    try {
      const nearest = await fetchNearestIntersection(lng, lat);
      if (clickMode === "start") {
        setStartId(nearest._id);
        setClickMode("end");
      } else {
        setEndId(nearest._id);
        setClickMode("start");
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-emerald-400">
            SafeWalk
          </span>
          <span className="hidden sm:inline text-xs text-gray-500">
            Safety-Weighted Pedestrian Routing
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <a
            href="/dashboard"
            className="rounded-md bg-gray-800 px-3 py-1 text-gray-300 hover:bg-gray-700 transition"
          >
            Dashboard
          </a>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-gray-800 p-4 flex flex-col gap-6">
          <RoutePanel
            intersections={intersections}
            startId={startId}
            endId={endId}
            onStartChange={setStartId}
            onEndChange={setEndId}
            onRouteResult={setRoute}
          />

          {route && (
            <div className="rounded-md bg-[#1e1e2f] p-3 text-sm">
              <p>
                <span className="text-gray-400">Mode:</span>{" "}
                <span className="font-medium text-emerald-400">{route.mode}</span>
              </p>
              <p>
                <span className="text-gray-400">Cost:</span>{" "}
                <span className="font-mono">{route.total_cost}</span>
              </p>
              <p>
                <span className="text-gray-400">Stops:</span>{" "}
                {route.path.length}
              </p>
            </div>
          )}

          <div className="text-xs text-gray-500">
            Click the map to set{" "}
            <span className="font-semibold text-gray-300">
              {clickMode === "start" ? "origin" : "destination"}
            </span>
          </div>

          <hr className="border-gray-800" />

          <IncidentForm onIncidentReported={loadGraph} />

          <hr className="border-gray-800" />

          <PanicButton />
        </aside>

        {/* Map */}
        <main className="flex-1">
          <MapView
            intersections={intersections}
            streets={streets}
            route={route}
            startId={startId}
            endId={endId}
            onMapClick={handleMapClick}
          />
        </main>
      </div>
    </div>
  );
}
