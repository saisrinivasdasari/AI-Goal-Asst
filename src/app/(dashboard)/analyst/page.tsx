"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  Brain,
  AlertTriangle,
  Sparkles,
  Zap,
  Target,
  ArrowRight,
  RefreshCw,
  Compass,
  Clock,
  ShieldAlert,
} from "lucide-react";

interface BehavioralReport {
  consistencyScore: number;
  completedTasksCount: number;
  missedTasksCount: number;
  rescheduledTasksCount: number;
  lifeAreaDistribution: Record<string, number>;
  frictionPoints: {
    taskId: string;
    taskTitle: string;
    goalTitle: string;
    rescheduledCount: number;
    reason: string;
  }[];
  energyAlignmentScore: number;
  insights: {
    observation: string;
    explanation: string;
    suggestion: string;
    actionableStep: string;
  }[];
}

interface FutureYouReport {
  goalId: string;
  goalTitle: string;
  targetDate: string;
  currentVelocityHoursPerWeek: number;
  inactionCostSummary: string;
  trajectories: {
    trajectory: "ON_TRACK_ACCELERATED" | "BASELINE_REALISTIC" | "DRIFT_STATUS_QUO";
    title: string;
    projectedCompletionDate: string;
    daysDelta: number;
    confidenceScore: number;
    description: string;
    milestoneOutcomes: {
      milestoneTitle: string;
      projectedDate: string;
      status: string;
    }[];
    identityNarrative: string;
  }[];
}

export default function AnalystPage() {
  const [report, setReport] = useState<BehavioralReport | null>(null);
  const [projections, setProjections] = useState<FutureYouReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"patterns" | "futureYou">("patterns");

  const fetchData = async () => {
    try {
      setLoading(true);
      const [patternsRes, projRes] = await Promise.all([
        fetch("/api/v1/analytics/patterns"),
        fetch("/api/v1/analytics/projections"),
      ]);

      const patternsJson = await patternsRes.json();
      if (patternsJson.success) setReport(patternsJson.data);

      const projJson = await projRes.json();
      if (projJson.success) setProjections(projJson.data);
    } catch (err) {
      console.error("Analyst data fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-sm font-mono text-neutral-400">Synthesizing Behavioral Patterns & Projections...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            <span>Behavioral Intelligence & Forecasting</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Personal Analyst</h1>
          <p className="text-xs text-neutral-400">
            Observation $\rightarrow$ Explanation $\rightarrow$ Suggestion $\rightarrow$ Multi-Year Trajectory Simulation.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-neutral-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("patterns")}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "patterns"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            14-Day Consistency Patterns
          </button>
          <button
            onClick={() => setActiveTab("futureYou")}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "futureYou"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            "Future You" 3-Trajectories
          </button>
        </div>
      </div>

      {activeTab === "patterns" ? (
        <div className="space-y-8">
          {/* Top Score Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-1">
              <span className="text-[11px] font-mono text-neutral-500 uppercase">14-Day Consistency</span>
              <div className="text-3xl font-extrabold text-cyan-400 font-mono">
                {report?.consistencyScore || 100}%
              </div>
              <p className="text-[10px] text-neutral-400 font-mono">
                {report?.completedTasksCount || 0} tasks completed on time
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-1">
              <span className="text-[11px] font-mono text-neutral-500 uppercase">Energy Alignment</span>
              <div className="text-3xl font-extrabold text-amber-400 font-mono">
                {report?.energyAlignmentScore || 90}%
              </div>
              <p className="text-[10px] text-neutral-400 font-mono">P0 tasks scheduled in Peak slots</p>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-1">
              <span className="text-[11px] font-mono text-neutral-500 uppercase">Pushed / Rescheduled</span>
              <div className="text-3xl font-extrabold text-neutral-200 font-mono">
                {report?.rescheduledTasksCount || 0}
              </div>
              <p className="text-[10px] text-neutral-400 font-mono">Tasks adjusted to prevent debt</p>
            </div>

            <div className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-1">
              <span className="text-[11px] font-mono text-neutral-500 uppercase">Avoidance Points</span>
              <div className="text-3xl font-extrabold text-rose-400 font-mono">
                {report?.frictionPoints.length || 0}
              </div>
              <p className="text-[10px] text-neutral-400 font-mono">Items pushed $\ge 2$ times</p>
            </div>
          </div>

          {/* Effort Allocation Bar */}
          {report?.lifeAreaDistribution && (
            <div className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Effort Allocation Across Life Areas</h3>
                <span className="text-xs font-mono text-neutral-500">14-Day Rolling Window</span>
              </div>

              <div className="flex h-3 rounded-full overflow-hidden bg-neutral-800">
                {Object.entries(report.lifeAreaDistribution).map(([area, percent], idx) => {
                  const colors = [
                    "bg-cyan-500",
                    "bg-blue-500",
                    "bg-purple-500",
                    "bg-amber-500",
                    "bg-emerald-500",
                  ];
                  return (
                    <div
                      key={area}
                      style={{ width: `${percent}%` }}
                      className={`${colors[idx % colors.length]} transition-all`}
                      title={`${area}: ${percent}%`}
                    />
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-4 pt-1 text-xs font-mono">
                {Object.entries(report.lifeAreaDistribution).map(([area, percent], idx) => (
                  <div key={area} className="flex items-center gap-1.5">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        ["bg-cyan-500", "bg-blue-500", "bg-purple-500", "bg-amber-500", "bg-emerald-500"][
                          idx % 5
                        ]
                      }`}
                    />
                    <span className="text-neutral-300">{area}:</span>
                    <span className="text-cyan-400 font-semibold">{percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Friction & Avoidance Alerts */}
          {report?.frictionPoints && report.frictionPoints.length > 0 && (
            <div className="p-6 rounded-2xl bg-rose-950/20 border border-rose-900/50 space-y-3">
              <div className="flex items-center gap-2 text-rose-400 text-xs font-semibold uppercase tracking-wider font-mono">
                <AlertTriangle className="w-4 h-4" />
                <span>Friction & Repeated Avoidance Alert</span>
              </div>
              <p className="text-xs text-neutral-300">
                The following tasks were postponed multiple times, indicating subconscious resistance or scope overload:
              </p>
              <div className="space-y-2 pt-2">
                {report.frictionPoints.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-neutral-950/80 border border-rose-900/40 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-semibold text-neutral-200">{item.taskTitle}</p>
                      <p className="text-[11px] text-neutral-400 font-mono">{item.goalTitle}</p>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800">
                      {item.reason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Behavioral Insights */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Jarvis Psychological Observations</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {report?.insights.map((ins, idx) => (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                      Observation {idx + 1}
                    </span>
                    <h4 className="text-sm font-semibold text-white">{ins.observation}</h4>
                    <p className="text-xs text-neutral-400 leading-relaxed">{ins.explanation}</p>
                  </div>

                  <div className="pt-3 border-t border-neutral-800/60 space-y-2">
                    <p className="text-xs text-cyan-300 italic font-medium">"{ins.suggestion}"</p>
                    <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800/80 text-[11px] text-emerald-400 font-mono">
                      Next Micro-Step: {ins.actionableStep}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Future You 3-Trajectories View */
        <div className="space-y-8">
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-2">
            <span className="text-[11px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
              Simulation Subject: {projections?.goalTitle}
            </span>
            <h2 className="text-lg font-bold text-white">Three Possible Horizons</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              Based on your rolling velocity of {projections?.currentVelocityHoursPerWeek} hrs/week, Jarvis simulates your trajectory under three behavioral conditions.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {projections?.trajectories.map((traj) => {
              const isAccelerated = traj.trajectory === "ON_TRACK_ACCELERATED";
              const isBaseline = traj.trajectory === "BASELINE_REALISTIC";
              const isDrift = traj.trajectory === "DRIFT_STATUS_QUO";

              const cardStyle = isAccelerated
                ? "border-emerald-500/50 bg-emerald-950/20"
                : isBaseline
                ? "border-cyan-500/40 bg-neutral-900/70"
                : "border-rose-900/60 bg-rose-950/20";

              const badgeStyle = isAccelerated
                ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                : isBaseline
                ? "bg-cyan-950 text-cyan-400 border-cyan-800"
                : "bg-rose-950 text-rose-400 border-rose-800";

              return (
                <div
                  key={traj.trajectory}
                  className={`p-6 rounded-2xl border ${cardStyle} space-y-5 flex flex-col justify-between shadow-xl relative overflow-hidden`}
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-full border font-mono ${badgeStyle}`}>
                        {isAccelerated ? "Optimal" : isBaseline ? "Current Pace" : "Avoidance"}
                      </span>
                      <span className="text-xs font-mono text-neutral-400">
                        {traj.confidenceScore}% probability
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-white">{traj.title}</h3>

                    <div className="p-3 rounded-xl bg-neutral-950/80 border border-neutral-800 space-y-1">
                      <span className="text-[10px] font-mono text-neutral-500 uppercase">Projected Delivery</span>
                      <p className="text-sm font-bold text-white font-mono flex items-center justify-between">
                        <span>{traj.projectedCompletionDate}</span>
                        <span className={traj.daysDelta < 0 ? "text-emerald-400" : traj.daysDelta > 0 ? "text-rose-400" : "text-neutral-400"}>
                          {traj.daysDelta < 0 ? `${traj.daysDelta}d early` : traj.daysDelta > 0 ? `+${traj.daysDelta}d delay` : "On target"}
                        </span>
                      </p>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed">{traj.description}</p>
                  </div>

                  <div className="pt-4 border-t border-neutral-800/60 space-y-2">
                    <span className="text-[10px] font-mono text-neutral-500 uppercase">Identity Narrative</span>
                    <p className="text-xs italic text-neutral-200">"{traj.identityNarrative}"</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

