"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import toast from "react-hot-toast";
import type { MapIntersection, MapStreet, MapRoute } from "@/components/CityMap";

const CityMap = dynamic(() => import("@/components/CityMap"), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

type ModuleId =
  | "safewalk"
  | "fleetvision"
  | "transitpulse"
  | "neurogrid"
  | "cityvoice"
  | "cityshield";

interface NavItem {
  id: ModuleId;
  icon: string;
  label: string;
  sub: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: "safewalk", icon: "🚶", label: "SafeWalk ADA", sub: "Inclusive pedestrian routing" },
  { id: "fleetvision", icon: "📸", label: "FleetVision", sub: "SAM 3 visual triage" },
  { id: "transitpulse", icon: "🚑", label: "Transit Pulse", sub: "EMS graph optimization" },
  { id: "neurogrid", icon: "⚡", label: "NeuroGrid", sub: "Predictive V2G utilities" },
  { id: "cityvoice", icon: "🎙️", label: "CityVoice AI", sub: "Audio/ASL 311 dispatch" },
  { id: "cityshield", icon: "🛡️", label: "CityShield", sub: "Immutable Solana ledger" },
];

// ── Main Component ──────────────────────────────────────────────────

export default function NerveCenterOS() {
  const [activeModule, setActiveModule] = useState<ModuleId>("safewalk");
  const [sosOpen, setSosOpen] = useState(false);
  const [a11yOpen, setA11yOpen] = useState(false);

  // SafeWalk state
  const [adaEnabled, setAdaEnabled] = useState(true);
  const [audioNavEnabled, setAudioNavEnabled] = useState(false);
  const [intersections, setIntersections] = useState<MapIntersection[]>([]);
  const [streets, setStreets] = useState<MapStreet[]>([]);
  const [originId, setOriginId] = useState<string>("");
  const [destId, setDestId] = useState<string>("");
  const [route, setRoute] = useState<MapRoute | null>(null);
  const [routeInfo, setRouteInfo] = useState<any>(null);

  // FleetVision state
  const [triageResult, setTriageResult] = useState<any>(null);
  const [triageLoading, setTriageLoading] = useState(false);

  // CityVoice state
  const [voiceResult, setVoiceResult] = useState<any>(null);
  const [voiceLoading, setVoiceLoading] = useState(false);

  // CityShield state
  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);

  // Weather state
  const [weather, setWeather] = useState({ aqi: 42, aqi_label: "Good", temp_f: 68, temp_c: 20, description: "" });

  // Accessibility state
  const [dyslexiaFont, setDyslexiaFont] = useState(false);
  const [highContrast, setHighContrast] = useState(false);

  // ── Effects ──────────────────────────────────────────────────────

  useEffect(() => {
    fetchWeather();
    fetchGraph();
  }, []);

  useEffect(() => {
    if (activeModule === "cityshield") {
      fetchLedger();
      const interval = setInterval(fetchLedger, 30000);
      return () => clearInterval(interval);
    }
  }, [activeModule]);

  useEffect(() => {
    document.body.classList.toggle("font-dyslexic", dyslexiaFont);
  }, [dyslexiaFont]);

  useEffect(() => {
    document.body.classList.toggle("high-contrast", highContrast);
  }, [highContrast]);

  // ── API Calls ────────────────────────────────────────────────────

  async function fetchWeather() {
    try {
      const res = await fetch(`${API}/api/weather/current`);
      if (res.ok) setWeather(await res.json());
    } catch { /* fallback values remain */ }
  }

  async function fetchGraph() {
    try {
      const [iRes, sRes] = await Promise.all([
        fetch(`${API}/api/route/intersections`),
        fetch(`${API}/api/route/streets`),
      ]);
      if (iRes.ok) {
        const nodes = await iRes.json();
        setIntersections(nodes);
        if (nodes.length >= 2) {
          setOriginId(nodes[0]._id);
          setDestId(nodes[nodes.length - 1]._id);
        }
      }
      if (sRes.ok) setStreets(await sRes.json());
    } catch { /* offline fallback */ }
  }

  async function executeRoute() {
    if (!originId || !destId) {
      toast.error("Select origin and destination first.");
      return;
    }
    try {
      const res = await fetch(`${API}/api/route/safewalk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: originId,
          destination: destId,
          ada_required: adaEnabled,
          mode: "safest",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRoute({ coordinates: data.coordinates });
      setRouteInfo(data);
      toast.success("Dijkstra route calculated successfully.");
    } catch (err: any) {
      toast.error(`Route failed: ${err.message}`);
    }
  }

  async function runSegmentation() {
    setTriageLoading(true);
    try {
      const res = await fetch(`${API}/api/vision/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: "Dashcam capture showing a blocked curb cut near an intersection. A construction barrier is obstructing the wheelchair ramp on the right side of the crosswalk.",
          image_url: "https://example.com/dashcam/frame_8849.jpg",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setTriageResult(await res.json());
      toast.success("SAM 3 Segmentation Complete");
    } catch (err: any) {
      toast.error(`Vision analysis failed: ${err.message}`);
    } finally {
      setTriageLoading(false);
    }
  }

  async function dispatchVoice() {
    setVoiceLoading(true);
    try {
      const res = await fetch(`${API}/api/voice/intake`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Yeah, I'm at 10th and Pine... the traffic light completely fell over and is blocking the crosswalk.",
          source: "kiosk",
          location: "10th St & Pine St",
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setVoiceResult(await res.json());
      toast.success("Units Dispatched. Ticket sent to CityShield.");
    } catch (err: any) {
      toast.error(`Voice intake failed: ${err.message}`);
    } finally {
      setVoiceLoading(false);
    }
  }

  async function triggerSOS() {
    setSosOpen(true);
    try {
      await fetch(`${API}/api/sos/trigger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: 37.954, longitude: -91.774, user_name: "Operator_01" }),
      });
    } catch { /* modal still shows */ }
  }

  async function logToLedger(entryType: string, description: string, sourceModule: string, data?: any) {
    try {
      await fetch(`${API}/api/ledger/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_type: entryType, description, source_module: sourceModule, data }),
      });
      toast.success("Record hashed to CityShield Ledger");
    } catch (err: any) {
      toast.error(`Ledger write failed: ${err.message}`);
    }
  }

  async function fetchLedger() {
    try {
      const res = await fetch(`${API}/api/ledger/entries?limit=20`);
      if (res.ok) setLedgerEntries(await res.json());
    } catch { /* silent */ }
  }

  // ── Render ───────────────────────────────────────────────────────

  return (
    <div className="h-screen flex overflow-hidden selection:bg-blue-500/30 transition-all duration-300">

      {/* ── SOS Modal ──────────────────────────────────────────── */}
      {sosOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-900 border-2 border-rose-500 rounded-2xl p-8 max-w-md w-full shadow-[0_0_50px_rgba(225,29,72,0.4)] text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-rose-500/10 animate-pulse z-0" />
            <div className="relative z-10">
              <div className="w-20 h-20 bg-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg animate-bounce">
                <span className="text-4xl">🚨</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">SOS Protocol Active</h2>
              <p className="text-slate-300 mb-6 text-sm">
                ElevenLabs AI is synthesizing an emergency dispatch call with your GPS coordinates.
              </p>
              <div className="flex items-center justify-center gap-1.5 h-12 mb-6 bg-slate-950 rounded-xl p-2 border border-rose-500/30">
                {[0.8, 1.2, 0.9, 1.5, 1.1].map((dur, i) => (
                  <div
                    key={i}
                    className="w-1.5 bg-rose-500 rounded-full"
                    style={{
                      animation: `pulse ${dur}s ease-in-out infinite`,
                      height: `${[40, 100, 60, 90, 50][i]}%`,
                    }}
                  />
                ))}
              </div>
              <p className="text-rose-400 font-mono text-xs mb-6">
                &quot;Dispatching EMS to Node A. Caller is immobile...&quot;
              </p>
              <button
                onClick={() => setSosOpen(false)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl border border-slate-700 transition-colors"
              >
                Cancel False Alarm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Accessibility Modal ────────────────────────────────── */}
      {a11yOpen && (
        <div className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-slate-900 border border-indigo-500/50 rounded-2xl p-8 max-w-sm w-full shadow-2xl relative">
            <button onClick={() => setA11yOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white">
              ✕
            </button>
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="text-indigo-400">♿</span> Accessibility Hub
            </h2>
            <p className="text-xs text-slate-400 mb-6">Customize NerveCenter OS for your cognitive and visual needs.</p>
            <div className="space-y-4">
              {[
                { label: "Dyslexia-Friendly Font", desc: "Increases letter spacing and weight.", checked: dyslexiaFont, toggle: () => { setDyslexiaFont(!dyslexiaFont); toast("Dyslexia-friendly font toggled.", { icon: "ℹ️" }); } },
                { label: "Maximum Contrast", desc: "Enhances color separation for low-vision.", checked: highContrast, toggle: () => { setHighContrast(!highContrast); toast("High Contrast mode toggled.", { icon: "ℹ️" }); } },
                { label: "Screen Reader Optimization", desc: "Forces ARIA-live assertive tags globally.", checked: true, toggle: () => toast("ARIA-live assertive applied.", { icon: "ℹ️" }) },
              ].map((opt) => (
                <label key={opt.label} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 cursor-pointer hover:border-indigo-500/50 transition-colors">
                  <div>
                    <p className="font-bold text-sm text-slate-200">{opt.label}</p>
                    <p className="text-[10px] text-slate-500">{opt.desc}</p>
                  </div>
                  <input type="checkbox" checked={opt.checked} onChange={opt.toggle} className="w-5 h-5 accent-indigo-500 rounded" />
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className="w-72 bg-slate-900 flex flex-col shadow-2xl z-20 border-r border-slate-800 shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-3xl font-black tracking-tighter text-blue-500">
            NerveCenter<span className="text-white">OS</span>
          </h1>
          <p className="text-xs text-slate-400 mt-2 font-mono">SYS_ARCH: HYBRID_SOS_V2_ELITE</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = activeModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveModule(item.id)}
                className={`w-full flex items-center space-x-4 p-3 rounded-xl transition-all ${
                  isActive
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-inner"
                    : "text-slate-400 hover:bg-slate-800 border border-transparent"
                }`}
              >
                <span className="text-2xl">{item.icon}</span>
                <div className="text-left">
                  <p className="font-bold text-sm">{item.label}</p>
                  <p className="text-[10px] opacity-70">{item.sub}</p>
                </div>
              </button>
            );
          })}
        </nav>

        <div className="p-6 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm">
              <p className="text-slate-500 text-xs">Auth: Auth0 Secured</p>
              <p className="font-bold text-slate-200">Operator_01</p>
            </div>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
          </div>
          <button
            onClick={triggerSOS}
            className="w-full bg-rose-600/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/50 transition-colors py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 shadow-[0_0_15px_rgba(225,29,72,0.2)]"
          >
            🚨 GLOBAL SOS
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ──────────────────────────────────── */}
      <main className="flex-1 relative h-full overflow-y-auto p-8 flex flex-col">

        {/* Top Status Bar */}
        <div className="w-full flex justify-between items-center mb-6 bg-slate-900/80 p-4 rounded-2xl border border-slate-700 backdrop-blur z-30 shadow-lg shrink-0">
          <div className="flex gap-4">
            <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
              <span className="text-2xl">🌤️</span>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Live AQI Level</p>
                <p className="text-sm font-bold text-emerald-400">{weather.aqi} ({weather.aqi_label})</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
              <span className="text-2xl">🌡️</span>
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Grid Temp</p>
                <p className="text-sm font-bold text-blue-400">{weather.temp_f}°F / {weather.temp_c}°C</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => setA11yOpen(true)}
            className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white border border-indigo-500/50 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-[0_0_15px_rgba(79,70,229,0.2)] flex items-center gap-2"
          >
            ⚙️ Accessibility Hub
          </button>
        </div>

        {/* ═══════════ MODULE: SAFEWALK ═══════════ */}
        {activeModule === "safewalk" && (
          <div className="flex flex-col flex-1">
            <header className="mb-6 flex justify-between items-end shrink-0">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">SafeWalk ADA Routing</h2>
                <p className="text-slate-400 mt-1">Dijkstra-optimized graph routing avoiding safety &amp; physical hazards.</p>
              </div>
              <button
                onClick={() => {
                  setAudioNavEnabled(!audioNavEnabled);
                  toast(audioNavEnabled ? "Audio Nav disabled." : "ElevenLabs Spatial Audio Navigation Linked.", { icon: audioNavEnabled ? "🔈" : "🔊" });
                }}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold border flex items-center gap-2 transition-all shadow-lg ${
                  audioNavEnabled
                    ? "bg-blue-600 hover:bg-blue-500 text-white border-blue-500"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-600"
                }`}
              >
                {audioNavEnabled ? "🔊" : "🔈"} {audioNavEnabled ? "Audio Nav Active" : "Enable Audio Nav"}
              </button>
            </header>

            <div className="flex-1 relative rounded-2xl border border-slate-700 overflow-hidden shadow-2xl bg-slate-800 flex min-h-[500px]">
              <CityMap intersections={intersections} streets={streets} route={route} />

              {/* Route Parameters Overlay */}
              <div className="absolute top-6 left-6 z-[1000] w-80 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col max-h-[90%] overflow-y-auto">
                <h3 className="font-bold text-white mb-4 border-b border-slate-700 pb-2">Route Parameters</h3>

                <div className="space-y-3 mb-6">
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 focus-within:border-blue-500 transition-colors">
                    <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Origin</label>
                    <select
                      value={originId}
                      onChange={(e) => setOriginId(e.target.value)}
                      className="w-full bg-transparent text-blue-400 font-semibold outline-none mt-1 cursor-pointer"
                    >
                      <option value="" className="bg-slate-950">Select origin…</option>
                      {intersections.map((n) => (
                        <option key={n._id} value={n._id} className="bg-slate-950">{n.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 focus-within:border-blue-500 transition-colors">
                    <label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Destination</label>
                    <select
                      value={destId}
                      onChange={(e) => setDestId(e.target.value)}
                      className="w-full bg-transparent text-blue-400 font-semibold outline-none mt-1 cursor-pointer"
                    >
                      <option value="" className="bg-slate-950">Select destination…</option>
                      {intersections.map((n) => (
                        <option key={n._id} value={n._id} className="bg-slate-950">{n.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div
                  className="mb-4 bg-blue-900/20 p-4 rounded-xl border border-blue-800/50 flex justify-between items-center cursor-pointer hover:bg-blue-900/30 transition-colors group"
                  onClick={() => {
                    setAdaEnabled(!adaEnabled);
                    toast(adaEnabled ? "Wheelchair routing constraints Disabled." : "Wheelchair routing constraints Enabled.", { icon: "ℹ️" });
                  }}
                >
                  <div>
                    <span className="text-sm font-bold text-blue-300 flex items-center gap-2">♿ ADA Compliant</span>
                    <p className="text-[10px] text-blue-400/70 mt-1 group-hover:text-blue-300">Bypass blocked curbs</p>
                  </div>
                  <div className={`w-12 h-6 rounded-full p-1 transition-colors ${adaEnabled ? "bg-blue-500" : "bg-slate-700"} shadow-inner shrink-0`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${adaEnabled ? "translate-x-6" : "translate-x-0"} shadow-sm`} />
                  </div>
                </div>

                <div className="mb-6 pt-4 border-t border-slate-700">
                  <h4 className="text-[10px] text-slate-400 font-bold mb-3 uppercase tracking-wider">IoT Sensor Overlays</h4>
                  <label className="flex items-center gap-3 text-sm text-slate-300 mb-3 cursor-pointer hover:text-white transition-colors">
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-indigo-500 rounded" onChange={() => toast("Traffic Matrix layer updated", { icon: "ℹ️" })} />
                    Traffic Density Matrix
                  </label>
                  <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                    <input type="checkbox" defaultChecked className="w-4 h-4 accent-indigo-500 rounded" onChange={() => toast("Acoustic Sensors synced", { icon: "ℹ️" })} />
                    Live Acoustic Sensors (dB)
                  </label>
                </div>

                <div className="bg-rose-950/30 p-3 rounded-lg border border-rose-900/50 flex justify-between items-center mb-6">
                  <span className="text-xs text-rose-400 font-medium">Hazards Bypassed:</span>
                  <span className="font-bold text-rose-500 animate-pulse">{routeInfo?.hazards_bypassed ?? 2} Critical</span>
                </div>

                <button
                  onClick={executeRoute}
                  className="w-full mt-auto bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
                >
                  Execute Safe Route
                </button>
              </div>

              {/* Audio Captioning Bar */}
              {audioNavEnabled && (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] bg-slate-900/90 backdrop-blur border border-slate-700 rounded-full px-6 py-3 shadow-2xl flex items-center gap-3">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
                  </span>
                  <p className="text-sm font-mono text-blue-300">&quot;In 100 feet, veer left to avoid construction blocking the right sidewalk.&quot;</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══════════ MODULE: FLEETVISION ═══════════ */}
        {activeModule === "fleetvision" && (
          <div className="flex flex-col flex-1">
            <header className="mb-6 shrink-0">
              <h2 className="text-3xl font-bold text-white tracking-tight">FleetVision AI</h2>
              <p className="text-slate-400 mt-1">Autonomous dashcam ingestion powered by Meta SAM 3 &amp; Gemini API.</p>
            </header>

            <div className="flex-1 flex gap-6">
              {/* Left: Image Ingest */}
              <div className="flex-1 bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5 z-0" />
                <h3 className="text-lg font-bold text-slate-200 mb-4 z-10 flex items-center gap-2">📹 Ingest Telemetry</h3>
                <div className="flex-1 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center bg-slate-950/50 relative overflow-hidden z-10">
                  <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-60" />
                  <div className="absolute top-[40%] left-[30%] w-48 h-32 border-4 border-purple-500 bg-purple-500/30 rounded-lg shadow-[0_0_20px_rgba(168,85,247,0.6)] flex items-start">
                    <span className="bg-purple-500 text-white text-xs font-bold px-2 py-1 -mt-6 ml-[-4px] rounded-t shadow-md">SAM3: ADA_OBSTRUCTION (98%)</span>
                  </div>
                </div>
                <button
                  onClick={runSegmentation}
                  disabled={triageLoading}
                  className="w-full mt-4 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-xl z-10 transition-colors shadow-lg shadow-purple-900/20 active:scale-95 disabled:opacity-50"
                >
                  {triageLoading ? "Processing…" : "Run Segmentation Model"}
                </button>
              </div>

              {/* Right: Intelligence Triage */}
              <div className="w-[450px] bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl z-0" />
                <h3 className="text-lg font-bold text-slate-200 mb-4 border-b border-slate-800 pb-2 flex justify-between items-center z-10">
                  <span>Intelligence Triage</span>
                  <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded">Gemini LLM</span>
                </h3>
                <div className="flex-1 bg-slate-950 rounded-xl border border-slate-800 p-5 font-mono text-sm text-emerald-400 overflow-y-auto shadow-inner z-10">
                  <pre className="whitespace-pre-wrap break-words">
{triageResult
  ? JSON.stringify(triageResult, null, 2)
  : `{
  "incident_id": "FV-8849-ADA",
  "status": "CRITICAL_VIOLATION",
  "hazard_type": "Blocked Curb Cut",
  "coordinates": {"lat": 37.952, "lng": -91.772},
  "vision_confidence": 0.984,
  "action_plan": "Dispatch rapid response to clear right-of-way.",
  "assigned_department": "Public Works",
  "priority": "HIGH"
}`}
                  </pre>
                </div>
                <button
                  onClick={() => logToLedger("ALERT_LOGGED", "FleetVision ADA violation detected", "FleetVision", triageResult)}
                  className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl border border-slate-700 transition-colors z-10 active:scale-95"
                >
                  Approve &amp; Send to CityShield
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ MODULE: TRANSIT PULSE ═══════════ */}
        {activeModule === "transitpulse" && (
          <div className="flex flex-col flex-1">
            <header className="mb-6 shrink-0">
              <h2 className="text-3xl font-bold text-white tracking-tight">Transit Pulse</h2>
              <p className="text-slate-400 mt-1">Preemptive emergency corridor routing via Graph Optimization.</p>
            </header>
            <div className="w-full flex-1 bg-slate-900 rounded-2xl border border-slate-800 flex items-center justify-center p-8 flex-col text-center relative overflow-hidden shadow-xl">
              <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?auto=format&fit=crop&q=80')] bg-cover bg-center opacity-10 grayscale" />
              <div className="z-10 bg-slate-950/90 p-10 rounded-3xl border border-rose-900/50 shadow-2xl backdrop-blur-md max-w-2xl w-full">
                <div className="w-20 h-20 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-rose-500/50">
                  <span className="text-4xl">🚑</span>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Mass Casualty Event Detected</h3>
                <p className="text-slate-400 mb-8 leading-relaxed">
                  Unit 4 responding from Phelps Health. Dijkstra optimization is currently calculating the absolute fastest corridor bypassing 3 major traffic nodes.
                </p>
                <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl mb-8 flex justify-between text-left">
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Standard ETA</p>
                    <p className="text-xl text-rose-500 font-bold line-through">14m 30s</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 font-bold uppercase">Optimized ETA</p>
                    <p className="text-xl text-emerald-500 font-bold">6m 15s</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    logToLedger("RECORD_LOGGED", "Green Wave executed across 12 intersections", "TransitPulse");
                    toast.success("Green Wave executed across 12 intersections");
                  }}
                  className="w-full bg-rose-600 hover:bg-rose-500 px-6 py-4 rounded-xl font-bold text-white shadow-[0_0_20px_rgba(225,29,72,0.4)] animate-pulse transition-all text-lg border border-rose-400 active:scale-95"
                >
                  Preempt Traffic Lights (Green Wave)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ MODULE: NEUROGRID ═══════════ */}
        {activeModule === "neurogrid" && (
          <div className="flex flex-col flex-1">
            <header className="mb-6 shrink-0">
              <h2 className="text-3xl font-bold text-white tracking-tight">NeuroGrid Utilities</h2>
              <p className="text-slate-400 mt-1">Predictive load balancing and V2G Solana Smart Contracts.</p>
            </header>
            <div className="grid grid-cols-2 gap-6 flex-1">
              {/* Left: Grid Load */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl flex flex-col">
                <h3 className="font-bold text-slate-300 mb-6 flex items-center justify-between">
                  <span>Grid Load Prediction (24h)</span>
                  <span className="text-xs bg-slate-800 px-2 py-1 rounded border border-slate-700">CNN-BiLSTM Model</span>
                </h3>
                <div className="flex-1 flex items-end gap-3 pb-4 border-b border-slate-800">
                  {[
                    { pct: 30, color: "blue" },
                    { pct: 45, color: "blue" },
                    { pct: 70, color: "orange" },
                    { pct: 95, color: "rose", label: "SURGE" },
                    { pct: 60, color: "orange" },
                    { pct: 40, color: "blue" },
                  ].map((bar, i) => (
                    <div
                      key={i}
                      className={`w-full bg-${bar.color}-500/${bar.pct > 80 ? 60 : bar.pct > 50 ? 40 : 20} rounded-t border-t ${bar.pct > 80 ? "border-t-2 border-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.5)]" : `border-${bar.color}-500/50`} relative group`}
                      style={{ height: `${bar.pct}%` }}
                    >
                      {bar.label ? (
                        <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-xs font-bold text-rose-100 bg-rose-600 px-2 py-1 rounded shadow-lg">
                          {bar.label}
                        </span>
                      ) : (
                        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs opacity-0 group-hover:opacity-100 text-slate-300 transition-opacity">
                          {bar.pct}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: V2G */}
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-8 shadow-xl flex flex-col justify-between relative overflow-hidden">
                <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl z-0" />
                <div className="z-10">
                  <h3 className="font-bold text-slate-300 mb-4 flex items-center gap-2">
                    Vehicle-to-Grid (V2G) Marketplace
                  </h3>
                  <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                    System is pre-authorizing micro-transactions to purchase auxiliary power from <strong className="text-emerald-400">1,402</strong> idle municipal electric vehicles.
                  </p>
                  <div className="bg-slate-950 p-4 rounded-xl text-sm font-mono text-emerald-400 border border-slate-800 shadow-inner">
                    <p className="text-slate-500 mb-2">{"// SOLANA MAINNET EXECUTION"}</p>
                    <p>&gt; Contract: <span className="text-blue-300">v2g_drawdown_protocol_v2</span></p>
                    <p>&gt; Target Wallets: <span className="text-blue-300">1,402</span></p>
                    <p>&gt; Est. Yield: <span className="text-emerald-300">4.2 MWh</span></p>
                  </div>
                </div>
                <button
                  onClick={() => logToLedger("CONTRACT_EXEC", "NeuroGrid V2G payment dispatched to 1,402 wallets. Status: Confirmed.", "NeuroGrid")}
                  className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl border border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-colors z-10 active:scale-95"
                >
                  Sign &amp; Execute Smart Contract
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ MODULE: CITYVOICE ═══════════ */}
        {activeModule === "cityvoice" && (
          <div className="flex flex-col flex-1">
            <header className="mb-6 shrink-0">
              <h2 className="text-3xl font-bold text-white tracking-tight">CityVoice AI</h2>
              <p className="text-slate-400 mt-1">Multi-modal 311 dispatch: Audio NLP and Computer Vision ASL Translation.</p>
            </header>
            <div className="bg-slate-900 rounded-2xl border border-slate-800 flex-1 flex overflow-hidden shadow-xl">
              {/* Left: Sensor Intake */}
              <div className="w-1/2 p-8 border-r border-slate-800 flex flex-col bg-slate-900/50 overflow-y-auto">
                <h3 className="text-slate-300 font-bold mb-6 flex items-center justify-between">
                  <span>Live Sensor Intake (Multi-Modal)</span>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500" />
                  </span>
                </h3>

                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 mb-4 shadow-inner">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-400">🎙️</div>
                      <div>
                        <span className="block text-sm font-bold text-white">Audio Relay: Kiosk #4</span>
                        <span className="block text-xs text-slate-500">00:14 / 00:45</span>
                      </div>
                    </div>
                    <span className="text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-full animate-pulse">Processing Voice</span>
                  </div>
                  <p className="text-sm text-slate-400 italic bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-sm">
                    &quot;Yeah, I&apos;m at 10th and Pine... the traffic light completely fell over and is blocking the crosswalk.&quot;
                  </p>
                </div>

                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 shadow-inner">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-900/50 rounded-full flex items-center justify-center text-indigo-400 border border-indigo-500/30">📹</div>
                      <div>
                        <span className="block text-sm font-bold text-white">ASL Video Relay (ADA)</span>
                        <span className="block text-xs text-slate-500">Computer Vision Translation Active</span>
                      </div>
                    </div>
                    <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-3 py-1 rounded-full">Standby</span>
                  </div>
                  <div
                    className="h-28 bg-slate-900 rounded-xl border border-dashed border-slate-700 flex flex-col items-center justify-center text-slate-500 text-sm group cursor-pointer hover:border-indigo-500/50 transition-colors"
                    onClick={() => toast("Connecting to Municipal ASL Camera Network...", { icon: "ℹ️" })}
                  >
                    <span className="text-2xl mb-1 group-hover:scale-110 transition-transform">🤟</span>
                    <span>Click to Simulate Deaf Citizen Video Feed</span>
                  </div>
                </div>
              </div>

              {/* Right: Gemini Output */}
              <div className="w-1/2 p-8 flex flex-col">
                <h3 className="text-slate-300 font-bold mb-6 flex items-center justify-between">
                  <span>Gemini Structured Output</span>
                  <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded">NLP JSON Parsing</span>
                </h3>
                <div className="flex-1 bg-slate-950 rounded-2xl border border-slate-800 p-6 shadow-inner overflow-y-auto">
                  <pre className="text-sm text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed">
{voiceResult
  ? JSON.stringify(voiceResult, null, 2)
  : `{
  "incident_id": "VOICE-992-INFRA",
  "incident_type": "Infrastructure Failure",
  "location": "Intersection of 10th St & Pine St",
  "priority_level": "HIGH",
  "ada_impact": true,
  "required_action": "Traffic Control Dispatch",
  "confidence_score": 0.95
}`}
                  </pre>
                </div>
                <div className="flex gap-4 mt-6">
                  <button
                    onClick={() => setActiveModule("safewalk")}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl border border-slate-700 transition-colors active:scale-95"
                  >
                    Route to SafeWalk
                  </button>
                  <button
                    onClick={dispatchVoice}
                    disabled={voiceLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl border border-blue-500 transition-colors active:scale-95 shadow-lg shadow-blue-900/20 disabled:opacity-50"
                  >
                    {voiceLoading ? "Dispatching…" : "Dispatch Unit"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════ MODULE: CITYSHIELD ═══════════ */}
        {activeModule === "cityshield" && (
          <div className="flex flex-col flex-1">
            <header className="mb-6 shrink-0">
              <h2 className="text-3xl font-bold text-white tracking-tight">CityShield Ledger</h2>
              <p className="text-slate-400 mt-1">Immutable, tamper-proof municipal records via Solana.</p>
            </header>
            <div className="bg-black rounded-2xl border border-slate-800 flex-1 p-8 font-mono text-sm overflow-y-auto shadow-[inset_0_0_50px_rgba(0,0,0,1)] relative">
              <div className="sticky top-0 bg-black/90 backdrop-blur pb-4 mb-4 border-b border-slate-800 flex justify-between items-center z-10">
                <p className="text-emerald-500 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  NETWORK: SOLANA MAINNET BETA
                </p>
                <p className="text-slate-500 text-xs">Uptime: 99.99%</p>
              </div>

              <div className="space-y-4 text-slate-300">
                {ledgerEntries.length > 0 ? (
                  ledgerEntries.map((entry: any, i: number) => (
                    <div
                      key={entry._id || i}
                      className={`border-l-2 pl-4 ${
                        entry.entry_type === "CONTRACT_EXEC"
                          ? "border-emerald-900 bg-emerald-950/20 p-2 rounded-r border-y border-r border-emerald-900/30"
                          : entry.entry_type === "ALERT_LOGGED"
                            ? "border-rose-800"
                            : "border-slate-800"
                      }`}
                    >
                      <p className="text-slate-500 text-xs mb-1">[{entry.timestamp}]</p>
                      <p>
                        <span className="text-purple-400">{entry.tx_hash?.slice(0, 8)}…{entry.tx_hash?.slice(-4)}</span>
                        {" :: "}
                        <span className={
                          entry.entry_type === "ALERT_LOGGED" ? "text-rose-400"
                            : entry.entry_type === "CONTRACT_EXEC" ? "text-emerald-400"
                              : "text-slate-300"
                        }>
                          {entry.entry_type}
                        </span>
                        {" :: "}
                        {entry.description}
                      </p>
                    </div>
                  ))
                ) : (
                  <>
                    <div className="border-l-2 border-slate-800 pl-4">
                      <p className="text-slate-500 text-xs mb-1">[TIMESTAMP: 169824001]</p>
                      <p><span className="text-purple-400">TX_9a8f…2b1c</span> :: RECORD_LOGGED :: SafeWalk ADA Route Recalculated for Node_C.</p>
                    </div>
                    <div className="border-l-2 border-slate-800 pl-4">
                      <p className="text-slate-500 text-xs mb-1">[TIMESTAMP: 169824045]</p>
                      <p><span className="text-purple-400">TX_3c4d…8e9f</span> :: <span className="text-rose-400">ALERT_LOGGED</span> :: FleetVision detected Critical ADA violation at 37.952, -91.772.</p>
                    </div>
                    <div className="border-l-2 border-emerald-900 pl-4 bg-emerald-950/20 p-2 rounded-r border-y border-r border-emerald-900/30">
                      <p className="text-slate-500 text-xs mb-1">[TIMESTAMP: 169824089]</p>
                      <p><span className="text-purple-400">TX_1a2b…3c4d</span> :: <span className="text-emerald-400">CONTRACT_EXEC</span> :: NeuroGrid V2G payment dispatched to 1,402 wallets. Status: Confirmed.</p>
                    </div>
                  </>
                )}
                <p className="text-emerald-500 mt-8 animate-pulse">Listening for new blocks_</p>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
