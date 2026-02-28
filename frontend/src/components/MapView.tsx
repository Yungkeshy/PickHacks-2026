"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  CircleMarker,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import type { Intersection, RouteResult, Street } from "@/lib/api";

const DEFAULT_CENTER: [number, number] = [37.9540, -91.7720];
const DEFAULT_ZOOM = 15;

const startIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const endIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function dangerColor(score: number): string {
  if (score >= 60) return "#ef4444";
  if (score >= 30) return "#f59e0b";
  return "#22c55e";
}

interface ClickHandlerProps {
  onMapClick: (lat: number, lng: number) => void;
}

function ClickHandler({ onMapClick }: ClickHandlerProps) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

interface Props {
  intersections: Intersection[];
  streets: Street[];
  route: RouteResult | null;
  startId: string | null;
  endId: string | null;
  onMapClick: (lat: number, lng: number) => void;
}

export default function MapView({
  intersections,
  streets,
  route,
  startId,
  endId,
  onMapClick,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-full w-full bg-[#1a1a2e]" />;

  const startNode = intersections.find((n) => n._id === startId);
  const endNode = intersections.find((n) => n._id === endId);

  const routeLatLngs: [number, number][] =
    route?.coordinates.map(([lng, lat]) => [lat, lng]) ?? [];

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      className="h-full w-full rounded-lg"
      zoomControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onMapClick={onMapClick} />

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
            }}
          >
            <Popup>
              <span className="text-xs">
                {st.name} — danger: {st.danger_score}
              </span>
            </Popup>
          </Polyline>
        );
      })}

      {/* Intersection nodes */}
      {intersections.map((node) => (
        <CircleMarker
          key={node._id}
          center={[
            node.location.coordinates[1],
            node.location.coordinates[0],
          ]}
          radius={5}
          pathOptions={{ color: "#6366f1", fillColor: "#6366f1", fillOpacity: 0.8 }}
        >
          <Popup>{node.name}</Popup>
        </CircleMarker>
      ))}

      {/* Safe route polyline */}
      {routeLatLngs.length > 0 && (
        <Polyline
          positions={routeLatLngs}
          pathOptions={{ color: "#10b981", weight: 6, opacity: 0.9 }}
        />
      )}

      {/* Start / End markers */}
      {startNode && (
        <Marker
          position={[
            startNode.location.coordinates[1],
            startNode.location.coordinates[0],
          ]}
          icon={startIcon}
        >
          <Popup>Start: {startNode.name}</Popup>
        </Marker>
      )}
      {endNode && (
        <Marker
          position={[
            endNode.location.coordinates[1],
            endNode.location.coordinates[0],
          ]}
          icon={endIcon}
        >
          <Popup>End: {endNode.name}</Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
