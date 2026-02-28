"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Popup,
  Marker,
  useMap,
} from "react-leaflet";
import L from "leaflet";

const CENTER: [number, number] = [37.9540, -91.7720];
const ZOOM = 15;

const userIcon = L.divIcon({
  className: "",
  html: '<div style="background:#3b82f6;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 0 15px #3b82f6"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

const hazardIcon = L.divIcon({
  className: "",
  html: '<div style="background:#f43f5e;width:16px;height:16px;transform:rotate(45deg);border:2px solid white;box-shadow:0 0 15px #f43f5e"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function dangerColor(score: number): string {
  if (score >= 60) return "#ef4444";
  if (score >= 30) return "#f59e0b";
  return "#22c55e";
}

export interface MapIntersection {
  _id: string;
  name: string;
  location: { type: string; coordinates: [number, number] };
}

export interface MapStreet {
  _id: string;
  name: string;
  geometry: { type: string; coordinates: [number, number][] };
  danger_score: number;
  is_accessible: boolean;
}

export interface MapRoute {
  coordinates: [number, number][];
}

interface Props {
  intersections: MapIntersection[];
  streets: MapStreet[];
  route: MapRoute | null;
}

function InvalidateOnMount() {
  const map = useMap();
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 200);
  }, [map]);
  return null;
}

export default function CityMap({ intersections, streets, route }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-full w-full bg-slate-800" />;

  const routeLatLngs: [number, number][] =
    route?.coordinates.map(([lng, lat]) => [lat, lng]) ?? [];

  return (
    <MapContainer
      center={CENTER}
      zoom={ZOOM}
      className="h-full w-full"
      zoomControl={false}
    >
      <InvalidateOnMount />
      <TileLayer
        attribution="&copy; CartoDB"
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        maxZoom={20}
      />

      {/* User position */}
      <Marker position={[37.954, -91.774]} icon={userIcon} />

      {/* Hazard marker */}
      <Marker position={[37.952, -91.7725]} icon={hazardIcon}>
        <Popup>
          <b className="text-rose-500">CRITICAL: ADA VIOLATION</b>
          <br />
          Blocked curb cut detected by FleetVision.
        </Popup>
      </Marker>

      {/* Street edges coloured by danger */}
      {streets.map((st) => {
        const positions: [number, number][] = st.geometry.coordinates.map(
          ([lng, lat]) => [lat, lng]
        );
        return (
          <Polyline
            key={st._id}
            positions={positions}
            pathOptions={{
              color: dangerColor(st.danger_score),
              weight: 3,
              opacity: 0.5,
              dashArray: st.is_accessible ? undefined : "8 6",
            }}
          >
            <Popup>
              <span className="text-xs">
                {st.name} — danger: {st.danger_score}
                {!st.is_accessible && " (NOT ADA accessible)"}
              </span>
            </Popup>
          </Polyline>
        );
      })}

      {/* Intersection nodes */}
      {intersections.map((node) => (
        <CircleMarker
          key={node._id}
          center={[node.location.coordinates[1], node.location.coordinates[0]]}
          radius={5}
          pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.8 }}
        >
          <Popup>{node.name}</Popup>
        </CircleMarker>
      ))}

      {/* Computed route */}
      {routeLatLngs.length > 0 && (
        <Polyline
          positions={routeLatLngs}
          pathOptions={{ color: "#10b981", weight: 6, opacity: 0.9 }}
        />
      )}
    </MapContainer>
  );
}
