"use client";

import { useState } from "react";
import { reportIncident } from "@/lib/api";

interface Props {
  onIncidentReported: () => void;
}

export default function IncidentForm({ onIncidentReported }: Props) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;

    setLoading(true);
    setStatus(null);

    try {
      const doc = await reportIncident(text.trim());
      setStatus(
        `Logged: ${doc.category ?? "unknown"} — severity ${doc.severity}/100`
      );
      setText("");
      onIncidentReported();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-amber-400">Report Incident</h2>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="e.g. Suspicious activity near 10th & State St"
        rows={3}
        className="rounded-md bg-[#1e1e2f] border border-gray-700 px-3 py-2 text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
      />
      <button
        type="submit"
        disabled={loading || !text.trim()}
        className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {loading ? "Analyzing…" : "Submit Report"}
      </button>
      {status && (
        <p
          className={`text-xs ${
            status.startsWith("Error") ? "text-red-400" : "text-emerald-400"
          }`}
        >
          {status}
        </p>
      )}
    </form>
  );
}
