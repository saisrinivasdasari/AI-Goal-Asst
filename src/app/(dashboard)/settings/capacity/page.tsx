"use client";

import { useState, useEffect } from "react";
import {
  Sliders,
  BatteryCharging,
  Save,
  RefreshCw,
  Sparkles,
  Zap,
  Clock,
  ShieldCheck,
} from "lucide-react";

export default function CapacitySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [capacity, setCapacity] = useState({
    workHoursPerWeek: 40,
    sleepHoursPerDay: 7.5,
    nonNegotiablesHoursPerWeek: 15,
  });

  const [slots, setSlots] = useState({
    morning: "HIGH",
    afternoon: "MEDIUM",
    evening: "LOW",
    night: "REST",
  });

  const fetchCapacity = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/profile/capacity");
      const json = await res.json();
      if (json.success && json.data) {
        setCapacity({
          workHoursPerWeek: json.data.capacityProfile?.workHoursPerWeek || 40,
          sleepHoursPerDay: json.data.capacityProfile?.sleepHoursPerDay || 7.5,
          nonNegotiablesHoursPerWeek: json.data.capacityProfile?.nonNegotiablesHoursPerWeek || 15,
        });
        if (json.data.energyProfile?.timeSlots) {
          setSlots(json.data.energyProfile.timeSlots);
        }
      }
    } catch (err) {
      console.error("Failed to load capacity:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCapacity();
  }, []);

  const totalWeeklyHours = 168;
  const sleepWeekly = capacity.sleepHoursPerDay * 7;
  const netCapacity = Math.max(
    0,
    totalWeeklyHours - (capacity.workHoursPerWeek + sleepWeekly + capacity.nonNegotiablesHoursPerWeek)
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setSuccessMsg(null);
      const res = await fetch("/api/v1/profile/capacity", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workHoursPerWeek: Number(capacity.workHoursPerWeek),
          sleepHoursPerDay: Number(capacity.sleepHoursPerDay),
          nonNegotiablesHoursPerWeek: Number(capacity.nonNegotiablesHoursPerWeek),
          energySlots: slots,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuccessMsg("Capacity & Energy architecture updated successfully.");
      }
    } catch (err) {
      console.error("Failed to save capacity:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-sm font-mono text-neutral-400">Loading Capacity Architecture...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider">
          <Sliders className="w-4 h-4" />
          <span>Biological & Cognitive Rhythm</span>
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Capacity & Energy Architecture</h1>
        <p className="text-xs text-neutral-400">
          Jarvis will never over-schedule beyond your true biological bandwidth.
        </p>
      </div>

      {/* Net Capacity Overview Card */}
      <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-1">
          <span className="text-[11px] font-mono text-neutral-500 uppercase">Work Baseline</span>
          <p className="text-xl font-bold text-neutral-200">{capacity.workHoursPerWeek} hrs/wk</p>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-mono text-neutral-500 uppercase">Sleep Architecture</span>
          <p className="text-xl font-bold text-neutral-200">{sleepWeekly.toFixed(1)} hrs/wk</p>
        </div>
        <div className="space-y-1">
          <span className="text-[11px] font-mono text-neutral-500 uppercase">Life / Commute</span>
          <p className="text-xl font-bold text-neutral-200">{capacity.nonNegotiablesHoursPerWeek} hrs/wk</p>
        </div>
        <div className="space-y-1 p-3 rounded-xl bg-cyan-950/40 border border-cyan-800/80">
          <span className="text-[11px] font-mono text-cyan-400 uppercase font-semibold">Net Available Goal Bandwidth</span>
          <p className="text-2xl font-extrabold text-cyan-300 font-mono">{netCapacity.toFixed(1)} hrs/wk</p>
        </div>
      </div>

      {successMsg && (
        <div className="p-3 rounded-lg bg-emerald-950/50 border border-emerald-800/80 text-emerald-300 text-xs">
          {successMsg}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-8">
        {/* Capacity Sliders */}
        <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-6">
          <h2 className="text-base font-semibold text-white">Weekly Time Commitments (168h Total)</h2>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300 font-medium">Work Hours per Week</span>
                <span className="font-mono text-cyan-400 font-semibold">{capacity.workHoursPerWeek} hrs</span>
              </div>
              <input
                type="range"
                min="0"
                max="80"
                step="1"
                value={capacity.workHoursPerWeek}
                onChange={(e) =>
                  setCapacity({ ...capacity, workHoursPerWeek: Number(e.target.value) })
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300 font-medium">Daily Sleep Baseline</span>
                <span className="font-mono text-cyan-400 font-semibold">{capacity.sleepHoursPerDay} hrs/night</span>
              </div>
              <input
                type="range"
                min="5"
                max="10"
                step="0.5"
                value={capacity.sleepHoursPerDay}
                onChange={(e) =>
                  setCapacity({ ...capacity, sleepHoursPerDay: Number(e.target.value) })
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-neutral-300 font-medium">Non-Negotiable Life Responsibilities (Commute, Meals, Family)</span>
                <span className="font-mono text-cyan-400 font-semibold">{capacity.nonNegotiablesHoursPerWeek} hrs/wk</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="1"
                value={capacity.nonNegotiablesHoursPerWeek}
                onChange={(e) =>
                  setCapacity({ ...capacity, nonNegotiablesHoursPerWeek: Number(e.target.value) })
                }
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* Energy Slots Configuration */}
        <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-6">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Cognitive Rhythm Matching (4-Slot Energy Profile)</h2>
            <p className="text-xs text-neutral-400">
              Jarvis automatically maps P0 Critical tasks to your High energy slots, and routine tasks to Low energy slots.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
              <span className="text-xs font-semibold text-neutral-300">Morning Slot (09:00 - 13:00)</span>
              <select
                value={slots.morning}
                onChange={(e) => setSlots({ ...slots, morning: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs font-mono"
              >
                <option value="HIGH">HIGH (Deep creative & architectural work)</option>
                <option value="MEDIUM">MEDIUM (Focused problem solving)</option>
                <option value="LOW">LOW (Administrative & routine)</option>
                <option value="REST">REST (Recovery)</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
              <span className="text-xs font-semibold text-neutral-300">Afternoon Slot (13:00 - 17:00)</span>
              <select
                value={slots.afternoon}
                onChange={(e) => setSlots({ ...slots, afternoon: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs font-mono"
              >
                <option value="HIGH">HIGH (Deep creative & architectural work)</option>
                <option value="MEDIUM">MEDIUM (Focused problem solving)</option>
                <option value="LOW">LOW (Administrative & routine)</option>
                <option value="REST">REST (Recovery)</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
              <span className="text-xs font-semibold text-neutral-300">Evening Slot (17:00 - 21:00)</span>
              <select
                value={slots.evening}
                onChange={(e) => setSlots({ ...slots, evening: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs font-mono"
              >
                <option value="HIGH">HIGH (Deep creative & architectural work)</option>
                <option value="MEDIUM">MEDIUM (Focused problem solving)</option>
                <option value="LOW">LOW (Administrative & routine)</option>
                <option value="REST">REST (Recovery)</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
              <span className="text-xs font-semibold text-neutral-300">Night Slot (21:00 - 09:00)</span>
              <select
                value={slots.night}
                onChange={(e) => setSlots({ ...slots, night: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200 text-xs font-mono"
              >
                <option value="HIGH">HIGH (Deep creative & architectural work)</option>
                <option value="MEDIUM">MEDIUM (Focused problem solving)</option>
                <option value="LOW">LOW (Administrative & routine)</option>
                <option value="REST">REST (Recovery)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>Save Architecture</span>
          </button>
        </div>
      </form>
    </div>
  );
}

