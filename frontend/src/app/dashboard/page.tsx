"use client";

import { useEffect, useState } from "react";
import { fetchIncidents, type IncidentDoc } from "@/lib/api";

function DashboardPage() {
  const [incidents, setIncidents] = useState<IncidentDoc[]>([]);

  useEffect(() => {
    fetchIncidents(20).then(setIncidents).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen p-8">
      <h1 className="mb-6 text-2xl font-bold text-emerald-400">Dashboard</h1>
      <p className="mb-4 text-gray-400">
        Welcome, <span className="text-white">User</span>
      </p>

      <h2 className="mb-3 text-lg font-semibold text-amber-400">
        Recent Incidents
      </h2>

      {incidents.length === 0 ? (
        <p className="text-sm text-gray-500">No incidents recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left text-gray-400">
                <th className="px-4 py-2">Time</th>
                <th className="px-4 py-2">Category</th>
                <th className="px-4 py-2">Severity</th>
                <th className="px-4 py-2">Street</th>
                <th className="px-4 py-2">Text</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((inc) => (
                <tr
                  key={inc._id}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30"
                >
                  <td className="px-4 py-2 text-gray-500">
                    {new Date(inc.reported_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2">{inc.category ?? "—"}</td>
                  <td className="px-4 py-2 font-mono">{inc.severity}</td>
                  <td className="px-4 py-2">{inc.parsed_street ?? "—"}</td>
                  <td className="px-4 py-2 text-gray-400 truncate max-w-xs">
                    {inc.raw_text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
