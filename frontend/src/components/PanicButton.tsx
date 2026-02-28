"use client";

import { useState } from "react";
import { triggerPanic } from "@/lib/api";

export default function PanicButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePanic() {
    setLoading(true);
    setError(null);

    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10_000,
        })
      );

      const blob = await triggerPanic(pos.coords.latitude, pos.coords.longitude);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "safewalk_distress.mp3";
      a.click();
      URL.revokeObjectURL(url);

      const audio = new Audio(url);
      audio.play().catch(() => {});
    } catch (err: any) {
      setError(err.message ?? "Failed to trigger panic mode");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handlePanic}
        disabled={loading}
        className="rounded-md bg-red-600 px-4 py-3 text-sm font-bold uppercase tracking-wider text-white transition hover:bg-red-500 active:scale-95 disabled:opacity-50"
      >
        {loading ? "Sending…" : "🚨 Panic Mode"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-[11px] text-gray-500">
        Generates an automated 911 dispatch audio with your GPS coordinates.
      </p>
    </div>
  );
}
