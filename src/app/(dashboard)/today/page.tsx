"use client";

import { useEffect, useState } from "react";
import {
  Compass,
  CheckCircle2,
  Circle,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Flame,
  ArrowRight,
  TrendingUp,
  Brain,
  Zap,
  Coffee,
  Calendar,
  Clock,
  ChevronRight,
} from "lucide-react";

interface TaskItem {
  id?: string;
  instanceId?: string;
  taskId?: string;
  title?: string;
  description?: string;
  priority?: "P0_CRITICAL" | "P1_NORMAL" | "P2_OPTIONAL" | "P1_IMPORTANT";
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED" | "CARRIED_FORWARD";
  scheduledDate?: string;
  requiredEnergy?: "HIGH" | "MEDIUM" | "LOW" | "RECOVERY" | "HIGH_FOCUS" | "LOW_RECOVERY";
  estimatedMinutes?: number;
  actualMinutes?: number;
  goalTitle?: string;
  whyReason?: string;
  task?: {
    id: string;
    title: string;
    description?: string;
    priority: "P0_CRITICAL" | "P1_NORMAL" | "P2_OPTIONAL" | "P1_IMPORTANT";
    estimatedMinutes: number;
    energyRequired: "HIGH" | "MEDIUM" | "LOW" | "RECOVERY" | "HIGH_FOCUS" | "LOW_RECOVERY";
    weeklyTarget?: {
      title: string;
      milestone?: {
        title: string;
        goal?: {
          id: string;
          title: string;
          whyStatement?: string;
        };
      };
    };
  };
}

interface MissionData {
  date: string;
  currentEnergySlot?: string;
  currentEnergyLevel?: string;
  emotionalAnchors?: {
    goalId: string;
    goalTitle: string;
    whyStatement: string;
  }[];
  tasks: TaskItem[];
  metrics?: {
    totalTasks: number;
    completedTasks: number;
    totalPlannedMinutes: number;
    completedMinutes: number;
  };
  summary?: {
    total: number;
    completed: number;
    totalMinutes: number;
  };
}

export default function TodayMissionPage() {
  const [mission, setMission] = useState<MissionData | null>(null);
  const [upcoming, setUpcoming] = useState<TaskItem[]>([]);
  const [activeTab, setActiveTab] = useState<"today" | "upcoming">("today");
  const [loading, setLoading] = useState(true);
  const [rescheduling, setRescheduling] = useState(false);
  const [pullingForward, setPullingForward] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [applyingLeave, setApplyingLeave] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const fetchMission = async () => {
    try {
      setLoading(true);
      const [resToday, resUpcoming] = await Promise.all([
        fetch("/api/v1/missions/today"),
        fetch("/api/v1/missions/upcoming"),
      ]);

      const jsonToday = await resToday.json();
      if (jsonToday.success) {
        setMission(jsonToday.data);
      }

      const jsonUpcoming = await resUpcoming.json();
      if (jsonUpcoming.success) {
        setUpcoming(jsonUpcoming.data || []);
      }
    } catch (err) {
      console.error("Failed to load mission:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMission();
  }, []);

  const toggleTaskStatus = async (taskInstanceId: string, currentStatus: string) => {
    const newStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";

    // Optimistic update
    setMission((prev) => {
      if (!prev) return prev;
      const prevSummary = prev.summary || {
        total: prev.metrics?.totalTasks || prev.tasks.length,
        completed: prev.metrics?.completedTasks || 0,
        totalMinutes: prev.metrics?.totalPlannedMinutes || 0,
      };
      const updatedCompleted =
        newStatus === "COMPLETED"
          ? prevSummary.completed + 1
          : Math.max(0, prevSummary.completed - 1);

      return {
        ...prev,
        tasks: prev.tasks.map((t) =>
          (t.id === taskInstanceId || t.instanceId === taskInstanceId)
            ? { ...t, status: newStatus as any }
            : t
        ),
        summary: {
          ...prevSummary,
          completed: updatedCompleted,
        },
      };
    });

    try {
      await fetch(`/api/v1/tasks/${taskInstanceId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
    } catch (err) {
      console.error("Failed to update status:", err);
      fetchMission();
    }
  };

  const handleAdaptiveReschedule = async () => {
    try {
      setRescheduling(true);
      setFeedbackMessage(null);
      const res = await fetch("/api/v1/schedule/reschedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: "SMART_ADAPTIVE" }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackMessage(json.data.jarvisExplanation || json.data.explanation);
        fetchMission();
      }
    } catch (err) {
      console.error("Reschedule failed:", err);
    } finally {
      setRescheduling(false);
    }
  };

  const handlePullForward = async () => {
    try {
      setPullingForward(true);
      setFeedbackMessage(null);
      const res = await fetch("/api/v1/missions/pull-forward", {
        method: "POST",
      });
      const json = await res.json();
      if (json.message) {
        setFeedbackMessage(json.message);
      }
      fetchMission();
    } catch (err) {
      console.error("Pull forward failed:", err);
    } finally {
      setPullingForward(false);
    }
  };

  const handleTakeLeave = async (days: number) => {
    try {
      setApplyingLeave(true);
      setFeedbackMessage(null);
      const res = await fetch("/api/v1/missions/take-leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days }),
      });
      const json = await res.json();
      if (json.message) {
        setFeedbackMessage(json.message);
      }
      setLeaveModalOpen(false);
      fetchMission();
    } catch (err) {
      console.error("Take leave failed:", err);
    } finally {
      setApplyingLeave(false);
    }
  };

  if (loading && !mission) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Hero Card Skeleton */}
        <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 space-y-4">
          <div className="w-32 h-4 bg-neutral-800 rounded-md" />
          <div className="w-56 h-7 bg-neutral-800 rounded-lg" />
          <div className="w-48 h-3 bg-neutral-800/60 rounded" />
          <div className="flex gap-2 pt-2">
            <div className="w-24 h-8 bg-neutral-800 rounded-xl" />
            <div className="w-24 h-8 bg-neutral-800 rounded-xl" />
          </div>
        </div>
        {/* Task Cards Skeleton */}
        <div className="space-y-3">
          <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 h-20" />
          <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 h-20" />
          <div className="p-4 rounded-2xl bg-neutral-900/40 border border-neutral-800/60 h-20" />
        </div>
      </div>
    );
  }

  const totalTasks = mission?.summary?.total ?? mission?.metrics?.totalTasks ?? 0;
  const completedTasks = mission?.summary?.completed ?? mission?.metrics?.completedTasks ?? 0;
  const totalMinutes = mission?.summary?.totalMinutes ?? mission?.metrics?.totalPlannedMinutes ?? 0;
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Top Banner: Mission Command */}
      <div className="p-4 sm:p-6 rounded-2xl bg-neutral-900/80 border border-neutral-800/90 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-cyan-400 text-[11px] font-mono uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5" />
              <span>Daily Execution Engine</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Today's Mission</h1>
            <p className="text-xs text-neutral-400 text-pretty">
              Focused execution matched to your natural cognitive rhythms.
            </p>
          </div>

          <div className="flex items-center gap-4 self-start sm:self-auto">
            <div className="text-left sm:text-right">
              <div className="text-2xl sm:text-3xl font-bold font-mono text-cyan-400 tabular-nums">
                {completionPercent}%
              </div>
              <div className="text-[10px] sm:text-[11px] text-neutral-400 font-mono">
                {completedTasks} of {totalTasks} completed
              </div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-neutral-950 rounded-full h-1.5 overflow-hidden border border-neutral-800/60">
          <div
            className="bg-gradient-to-r from-cyan-500 to-emerald-400 h-full transition-all duration-500"
            style={{ width: `${completionPercent}%` }}
          />
        </div>

        {/* Action Buttons Row (Thumb Friendly on Mobile) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {/* Pull Forward */}
          <button
            onClick={handlePullForward}
            disabled={pullingForward}
            title="Finished today's tasks or feel high energy? Pull tomorrow's task forward!"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/60 text-amber-300 text-xs font-semibold shadow-sm transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <Zap className={`w-3.5 h-3.5 ${pullingForward ? "animate-spin" : ""}`} />
            <span>{pullingForward ? "Pulling..." : "Pull Next"}</span>
          </button>

          {/* Rest / Leave Mode */}
          <button
            onClick={() => setLeaveModalOpen(true)}
            title="Need a break or vacation? Smoothly slides upcoming tasks forward with zero penalty."
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-950/40 hover:bg-purple-900/60 border border-purple-800/60 text-purple-300 text-xs font-semibold shadow-sm transition-all active:scale-[0.98]"
          >
            <Coffee className="w-3.5 h-3.5" />
            <span>Rest / Leave</span>
          </button>

          {/* Adaptive Reschedule */}
          <button
            onClick={handleAdaptiveReschedule}
            disabled={rescheduling}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-600/15 transition-all active:scale-[0.98] disabled:opacity-50 ml-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rescheduling ? "animate-spin" : ""}`} />
            <span>{rescheduling ? "Optimizing..." : "Reschedule"}</span>
          </button>
        </div>
      </div>

      {/* Jarvis Feedback Banner */}
      {feedbackMessage && (
        <div className="p-4 rounded-xl bg-cyan-950/50 border border-cyan-800/80 flex items-start gap-3 shadow-lg">
          <Brain className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-xs text-cyan-200 leading-relaxed">
            <span className="font-semibold text-cyan-300">Jarvis Insight: </span>
            {feedbackMessage}
          </div>
        </div>
      )}

      {/* Rest / Leave Modal */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Grab handle on mobile */}
            <div className="w-10 h-1 rounded-full bg-neutral-700/80 mx-auto -mt-2 mb-2 sm:hidden" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-800 flex items-center justify-center text-purple-400">
                <Coffee className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Fluid Rest & Leave Mode</h3>
                <p className="text-xs text-neutral-400">
                  Take time off with zero guilt. Jarvis slides future tasks forward.
                </p>
              </div>
            </div>

            <p className="text-xs text-neutral-300 leading-relaxed text-pretty">
              How many days of rest do you need? Your target completion date will be gently extended with no backlog snowball debt.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              {[
                { days: 1, label: "1 Day Rest", desc: "Resume tomorrow" },
                { days: 2, label: "2 Days (Weekend)", desc: "Quick recharge" },
                { days: 4, label: "4 Days Off", desc: "Mid-week reset" },
                { days: 7, label: "1 Full Week", desc: "Vacation / Travel" },
              ].map((preset) => (
                <button
                  key={preset.days}
                  onClick={() => handleTakeLeave(preset.days)}
                  disabled={applyingLeave}
                  className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-purple-500/60 hover:bg-purple-950/20 text-left transition-all active:scale-[0.98] group disabled:opacity-50"
                >
                  <span className="text-xs font-bold text-neutral-200 group-hover:text-purple-300 block">
                    {preset.label}
                  </span>
                  <span className="text-[10px] text-neutral-500">{preset.desc}</span>
                </button>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setLeaveModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-medium active:scale-[0.98]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs Header */}
      <div className="flex items-center gap-3 border-b border-neutral-800/80 pb-3">
        <button
          onClick={() => setActiveTab("today")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "today"
              ? "bg-cyan-950 border border-cyan-800 text-cyan-300 shadow-md"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Today's Mission ({totalTasks})</span>
        </button>

        <button
          onClick={() => setActiveTab("upcoming")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
            activeTab === "upcoming"
              ? "bg-cyan-950 border border-cyan-800 text-cyan-300 shadow-md"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Upcoming This Week ({upcoming.length})</span>
        </button>
      </div>

      {/* TAB 1: TODAY'S MISSION */}
      {activeTab === "today" && (
        <div className="space-y-6">
          {/* Emotional "Why" Motivation Anchors */}
          {mission?.emotionalAnchors && mission.emotionalAnchors.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mission.emotionalAnchors.map((anchor) => (
                <div
                  key={anchor.goalId}
                  className="p-5 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition-all space-y-2 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-cyan-500/10 to-transparent pointer-events-none" />
                  <div className="flex items-center gap-2 text-[11px] font-semibold text-amber-400 font-mono uppercase tracking-wider">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Primary Why Anchor • {anchor.goalTitle}</span>
                  </div>
                  <p className="text-sm font-medium text-neutral-200 italic leading-snug">
                    "{anchor.whyStatement}"
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Checklist */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <span>Prioritized Checklist</span>
                <span className="text-xs font-mono text-neutral-500">
                  ({totalTasks} tasks)
                </span>
              </h2>
              <span className="text-xs font-mono text-neutral-400">
                Total Allocated: {totalMinutes} mins
              </span>
            </div>

            {mission?.tasks && mission.tasks.length > 0 ? (
              <div className="space-y-3">
                {mission.tasks.map((taskInstance) => {
                  const taskId = taskInstance.id || taskInstance.instanceId || "";
                  const taskTitle = taskInstance.title || taskInstance.task?.title || "Untitled Task";
                  const priority = taskInstance.priority || taskInstance.task?.priority || "P1_NORMAL";
                  const isCompleted = taskInstance.status === "COMPLETED";
                  const isP0 = priority === "P0_CRITICAL";
                  const isP2 = priority === "P2_OPTIONAL";
                  const goalTitle = taskInstance.goalTitle || taskInstance.task?.weeklyTarget?.milestone?.goal?.title || "Active Goal";
                  const estimatedMinutes = taskInstance.estimatedMinutes || taskInstance.task?.estimatedMinutes || 30;
                  const energy = taskInstance.requiredEnergy || taskInstance.task?.energyRequired || "MEDIUM";

                  return (
                    <div
                      key={taskId}
                      onClick={() => toggleTaskStatus(taskId, taskInstance.status)}
                      className={`group p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 active:scale-[0.99] ${
                        isCompleted
                          ? "bg-neutral-950/70 border-neutral-800/40 opacity-50"
                          : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/90 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                        <button
                          className="w-10 h-10 -ml-1 rounded-xl flex items-center justify-center text-neutral-400 group-hover:text-cyan-400 active:scale-90 transition-all shrink-0"
                          aria-label="Toggle task completion"
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 animate-in zoom-in-75" />
                          ) : (
                            <Circle className="w-5 h-5 group-hover:text-cyan-400" />
                          )}
                        </button>

                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-xs sm:text-sm font-medium ${
                                isCompleted
                                  ? "line-through text-neutral-500"
                                  : "text-neutral-200 group-hover:text-white"
                              }`}
                            >
                              {taskTitle}
                            </span>

                            {isP0 && (
                              <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-md bg-rose-950/60 text-rose-300 border border-rose-800/50 uppercase">
                                P0 Critical
                              </span>
                            )}
                            {isP2 && (
                              <span className="text-[9px] sm:text-[10px] font-semibold px-2 py-0.5 rounded-md bg-neutral-800 text-neutral-400 uppercase">
                                P2 Optional
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-neutral-400 font-mono">
                            <span className="truncate max-w-[120px] sm:max-w-none">{goalTitle}</span>
                            <span>•</span>
                            <span className="tabular-nums">{estimatedMinutes}m</span>
                            <span>•</span>
                            <span className="uppercase text-cyan-400/90">
                              {energy} Energy
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 text-neutral-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl bg-neutral-900/30 border border-dashed border-neutral-800 space-y-3">
                <Sparkles className="w-8 h-8 text-neutral-600 mx-auto" />
                <h3 className="text-sm font-medium text-neutral-300">All missions clear for today</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                  Outstanding job! You've cleared today's checklist. Feel free to pull forward tomorrow's task or rest and recharge.
                </p>
                {upcoming.length > 0 && (
                  <button
                    onClick={handlePullForward}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md inline-flex items-center gap-1.5 transition-all"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Pull Forward Next Task</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: UPCOMING THIS WEEK */}
      {activeTab === "upcoming" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Upcoming This Week</h2>
              <p className="text-xs text-neutral-400">
                Tasks distributed across the week matching your sustainable capacity.
              </p>
            </div>
            <span className="text-xs font-mono text-cyan-400">{upcoming.length} Tasks Scheduled</span>
          </div>

          {upcoming.length > 0 ? (
            <div className="space-y-3">
              {upcoming.map((task) => (
                <div
                  key={task.id}
                  className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800 hover:border-neutral-700 transition-all flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono px-2 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-cyan-400 font-semibold">
                        {task.scheduledDate}
                      </span>
                      <span className="text-sm font-medium text-neutral-200">
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-neutral-500 font-mono">
                      <span>{task.goalTitle}</span>
                      <span>•</span>
                      <span>{task.estimatedMinutes}m</span>
                      <span>•</span>
                      <span className="uppercase text-neutral-400">{task.requiredEnergy}</span>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      if (!task.id) return;
                      await fetch(`/api/v1/tasks/${task.id}/status`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "PENDING" }),
                      });
                      handlePullForward();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-cyan-600 hover:text-white text-neutral-300 text-xs font-medium transition-all shrink-0 flex items-center gap-1"
                  >
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span>Pull into Today</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center rounded-2xl bg-neutral-900/30 border border-dashed border-neutral-800 space-y-2">
              <Calendar className="w-8 h-8 text-neutral-600 mx-auto" />
              <h3 className="text-sm font-medium text-neutral-300">No upcoming tasks this week</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto">
                All scheduled tasks for this week have been completed or no future tasks are queued.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

