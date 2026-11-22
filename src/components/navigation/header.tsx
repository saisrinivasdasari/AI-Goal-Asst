"use client";

import { useEffect, useState } from "react";
import { BatteryCharging, Zap, ShieldCheck } from "lucide-react";

function getFormattedTime(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveEnergySlot(hour: number): string {
  if (hour >= 9 && hour < 13) return "HIGH";
  if (hour >= 13 && hour < 17) return "MEDIUM";
  if (hour >= 17 && hour < 21) return "LOW";
  return "REST";
}

export function Header() {
  const [energySlot, setEnergySlot] = useState<string>("MEDIUM");
  const [capacity] = useState<number>(60.5);
  const [time, setTime] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const now = new Date();
    setTime(getFormattedTime());
    setEnergySlot(resolveEnergySlot(now.getHours()));

    const interval = setInterval(() => {
      const current = new Date();
      setTime(getFormattedTime());
      setEnergySlot(resolveEnergySlot(current.getHours()));
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const getEnergyBadge = (slot: string) => {
    switch (slot) {
      case "HIGH":
        return {
          label: "Peak Energy Slot",
          color: "bg-amber-950/60 text-amber-400 border-amber-800/60",
          icon: Zap,
        };
      case "MEDIUM":
        return {
          label: "Medium Energy Slot",
          color: "bg-blue-950/60 text-blue-400 border-blue-800/60",
          icon: BatteryCharging,
        };
      case "LOW":
        return {
          label: "Low Energy Slot",
          color: "bg-purple-950/60 text-purple-400 border-purple-800/60",
          icon: BatteryCharging,
        };
      default:
        return {
          label: "Rest & Recovery Slot",
          color: "bg-neutral-900 text-neutral-400 border-neutral-800",
          icon: ShieldCheck,
        };
    }
  };

  const badge = getEnergyBadge(energySlot);
  const BadgeIcon = badge.icon;

  return (
    <header className="h-14 sm:h-16 border-b border-neutral-800/80 bg-neutral-950/80 backdrop-blur-xl px-4 sm:px-6 md:px-8 flex items-center justify-between sticky top-0 z-30">
      <div className="flex items-center gap-3">
        {/* Mobile Brand Mark */}
        <div className="flex md:hidden items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm">
            <span className="text-[11px] font-black text-white">J</span>
          </div>
          <span className="text-xs font-bold text-white tracking-wider">JARVIS</span>
        </div>

        {/* Desktop / Tablet Time */}
        {mounted && time ? (
          <span className="text-xs text-neutral-400 font-mono hidden sm:inline tabular-nums">
            {time}
          </span>
        ) : (
          <span className="hidden sm:inline-block w-36 h-4 bg-neutral-900/60 rounded animate-pulse" />
        )}
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Real-time Energy Slot Badge */}
        {mounted ? (
          <div className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium border ${badge.color}`}>
            <BadgeIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{badge.label}</span>
            <span className="sm:hidden font-mono">{energySlot} SLOT</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium border border-neutral-800 bg-neutral-900/60 text-neutral-500">
            <BatteryCharging className="w-3.5 h-3.5 opacity-40" />
            <span className="w-16 sm:w-24 h-3 bg-neutral-800/80 rounded animate-pulse" />
          </div>
        )}

        {/* Capacity Indicator */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-medium bg-neutral-900 border border-neutral-800 text-neutral-300">
          <span className="w-1.5 sm:w-2 h-1.5 sm:h-2 rounded-full bg-cyan-400" />
          <span className="tabular-nums">
            <span className="hidden sm:inline">Cap: </span>{capacity}h<span className="hidden sm:inline">/wk</span>
          </span>
        </div>
      </div>
    </header>
  );
}
