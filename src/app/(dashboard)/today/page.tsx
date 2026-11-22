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
  Brain,
  Zap,
  Coffee,
  Calendar,
  Clock,
  Heart,
  BookOpen,
} from "lucide-react";
import { FloatingUndoToast } from "@/components/common/floating-undo-toast";

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
  rescheduledCount?: number;
  goalTitle?: string;
  whyReason?: string;
  costOfInaction?: string;
  dreamVision?: string;
  isEnergyMatched?: boolean;
  notes?: string;
  task?: {
    id: string;
    title: string;
    description?: string;
    priority: "P0_CRITICAL" | "P1_NORMAL" | "P2_OPTIONAL" | "P1_IMPORTANT";
    estimatedMinutes: number;
    energyRequired?: "HIGH" | "MEDIUM" | "LOW" | "RECOVERY" | "HIGH_FOCUS" | "LOW_RECOVERY";
    requiredEnergy?: "HIGH" | "MEDIUM" | "LOW" | "RECOVERY" | "HIGH_FOCUS" | "LOW_RECOVERY";
    weeklyTarget?: {
      title: string;
      milestone?: {
        title: string;
        goal?: {
          id: string;
          title: string;
          whyStatement?: string;
          whyReason?: string;
          costOfInaction?: string;
          dreamVision?: string;
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

interface UndoToastState {
  id: string;
  title: string;
  message: string;
  onUndo: () => Promise<void>;
}

export default function TodayMissionPage() {
  const [mission, setMission] = useState<MissionData | null>(null);
  const [upcoming, setUpcoming] = useState<TaskItem[]>([]);
  const [activeTab, setActiveTab] = useState<"today" | "upcoming">("today");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [pullingForward, setPullingForward] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [applyingLeave, setApplyingLeave] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Anti-procrastination & Goal-achiever states
  const [undoToast, setUndoToast] = useState<UndoToastState | null>(null);
  const [deferringTaskId, setDeferringTaskId] = useState<string | null>(null);
  const [shrinkingTaskId, setShrinkingTaskId] = useState<string | null>(null);
  const [journalInputId, setJournalInputId] = useState<string | null>(null);
  const [journalText, setJournalText] = useState("");
  const [savingJournal, setSavingJournal] = useState(false);
  const [journalSavedId, setJournalSavedId] = useState<string | null>(null);
  const [whyAnchorModal, setWhyAnchorModal] = useState<{
    isOpen: boolean;
    taskTitle: string;
    goalTitle: string;
    whyReason: string;
    dreamVision?: string;
    costOfInaction?: string;
  } | null>(null);

  const fetchMission = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      const resToday = await fetch("/api/v1/missions/today");
      const jsonToday = await resToday.json();

      if (jsonToday.success && jsonToday.data) {
        setMission(jsonToday.data);
      } else {
        throw new Error(jsonToday.error?.message || "Failed to load today's mission data");
      }
    } catch (err: any) {
      console.error("Failed to load mission:", err);
      setLoadError(err.message || "Unable to reach server. Please check connection.");
    } finally {
      setLoading(false);
    }

    // Lazily fetch upcoming tasks in the background without blocking today's view
    fetch("/api/v1/missions/upcoming")
      .then((res) => res.json())
      .then((jsonUpcoming) => {
        if (jsonUpcoming.success && jsonUpcoming.data) {
          setUpcoming(jsonUpcoming.data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchMission();
  }, []);

  const getDaysToWeekend = () => {
    const day = new Date().getDay(); // 0 is Sun, 6 is Sat
    if (day === 6) return 1; // Sat -> Sun
    if (day === 0) return 6; // Sun -> next Sat
    return 6 - day; // Mon(1)->Sat(5), Fri(5)->Sat(1)
  };

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
          t.id === taskInstanceId || t.instanceId === taskInstanceId
            ? { ...t, status: newStatus as any }
            : t
        ),
        summary: {
          ...prevSummary,
          completed: updatedCompleted,
        },
      };
    });

    // If completed, open micro-journal prompt
    if (newStatus === "COMPLETED") {
      setJournalInputId(taskInstanceId);
      setJournalText("");
    } else {
      if (journalInputId === taskInstanceId) {
        setJournalInputId(null);
      }
    }

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

  const handleDeferTask = async (taskInstanceId: string, days: number, taskTitle: string) => {
    try {
      setDeferringTaskId(taskInstanceId);

      // Optimistic removal from today's list
      const originalMission = mission;
      setMission((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.filter(
            (t) => t.id !== taskInstanceId && t.instanceId !== taskInstanceId
          ),
        };
      });

      const res = await fetch("/api/v1/missions/defer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskInstanceId, days }),
      });
      const json = await res.json();

      if (json.success && json.data) {
        const recalc = json.data.arrivalRecalculation;
        const arrivalMsg = recalc?.message ||
          (recalc?.targetDate
            ? `Finish line: ${recalc.targetDate}`
            : `Pushed ${days === 1 ? "to tomorrow" : "to weekend"} • Horizon updated`);

        const previousDateToRestore = json.data.previousDate || new Date().toISOString().split("T")[0];

        setUndoToast({
          id: taskInstanceId,
          title: taskTitle,
          message: arrivalMsg,
          onUndo: async () => {
            try {
              const undoRes = await fetch("/api/v1/missions/undo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  taskInstanceId,
                  previousDate: previousDateToRestore,
                }),
              });
              const undoJson = await undoRes.json();
              if (undoJson.success) {
                setFeedbackMessage(`Restored "${taskTitle}" back to today's mission.`);
              }
              await fetchMission();
            } catch (e) {
              console.error("Failed to undo:", e);
              await fetchMission();
            }
          },
        });
      } else {
        setMission(originalMission);
      }
    } catch (err) {
      console.error("Defer task failed:", err);
      fetchMission();
    } finally {
      setDeferringTaskId(null);
    }
  };

  const handleShrinkTask = async (taskInstanceId: string) => {
    try {
      setShrinkingTaskId(taskInstanceId);
      const res = await fetch("/api/v1/missions/shrink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskInstanceId, targetMinutes: 10 }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackMessage(
          json.data?.message ||
            "Shrunk task to a 10-minute micro-step. Just do the first 10 minutes to build momentum!"
        );
        fetchMission();
      }
    } catch (err) {
      console.error("Shrink task failed:", err);
    } finally {
      setShrinkingTaskId(null);
    }
  };

  const handleSaveJournal = async (taskInstanceId: string) => {
    if (!journalText.trim()) return;
    try {
      setSavingJournal(true);
      const res = await fetch("/api/v1/journal/from-task", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskInstanceId,
          takeaway: journalText.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setJournalSavedId(taskInstanceId);
        setJournalInputId(null);
        setJournalText("");
        setTimeout(() => {
          setJournalSavedId(null);
        }, 5000);
      }
    } catch (err) {
      console.error("Failed to save journal takeaway:", err);
    } finally {
      setSavingJournal(false);
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

  const handlePullForward = async (targetInstanceId?: string) => {
    try {
      setPullingForward(true);
      setFeedbackMessage(null);
      const res = await fetch("/api/v1/missions/pull-forward", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(targetInstanceId ? { taskInstanceId: targetInstanceId } : {}),
      });
      const json = await res.json();
      if (json.success && json.task) {
        const taskTitle = json.task.title;
        const taskInstanceId = json.task.id;
        const previousDate = json.previousDate;

        setFeedbackMessage(json.message);

        // Show Undo Toast for Pull Next
        setUndoToast({
          id: taskInstanceId,
          title: taskTitle,
          message: `Pulled forward "${taskTitle}" to today`,
          onUndo: async () => {
            try {
              const undoRes = await fetch("/api/v1/missions/undo", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  taskInstanceId,
                  previousDate,
                }),
              });
              const undoJson = await undoRes.json();
              if (undoJson.success) {
                setFeedbackMessage(`Restored "${taskTitle}" back to upcoming queue.`);
              }
              await fetchMission();
            } catch (e) {
              console.error("Failed to undo pull forward:", e);
              await fetchMission();
            }
          },
        });

        await fetchMission();
      } else if (json.message) {
        setFeedbackMessage(json.message);
      }
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
        <div className="p-4 sm:p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800/80 space-y-4">
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

  if (loadError && !mission) {
    return (
      <div className="p-8 text-center rounded-2xl bg-neutral-900/40 border border-rose-900/40 space-y-4">
        <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
        <h3 className="text-sm font-semibold text-white">Unable to Load Today's Mission</h3>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto">{loadError}</p>
        <button
          onClick={fetchMission}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md inline-flex items-center gap-1.5 transition-all active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const totalTasks = mission?.summary?.total ?? mission?.metrics?.totalTasks ?? 0;
  const completedTasks = mission?.summary?.completed ?? mission?.metrics?.completedTasks ?? 0;
  const totalMinutes = mission?.summary?.totalMinutes ?? mission?.metrics?.totalPlannedMinutes ?? 0;
  const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
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
            onClick={() => handlePullForward()}
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
        <div className="p-4 rounded-xl bg-cyan-950/50 border border-cyan-800/80 flex items-start gap-3 shadow-lg animate-in fade-in duration-200">
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
                  const goalTitle =
                    taskInstance.goalTitle ||
                    taskInstance.task?.weeklyTarget?.milestone?.goal?.title ||
                    "Active Goal";
                  const estimatedMinutes =
                    taskInstance.estimatedMinutes || taskInstance.task?.estimatedMinutes || 30;
                  const energy =
                    taskInstance.requiredEnergy ||
                    taskInstance.task?.requiredEnergy ||
                    taskInstance.task?.energyRequired ||
                    "MEDIUM";

                  return (
                    <div
                      key={taskId}
                      className={`group p-3.5 sm:p-4 rounded-2xl border transition-all ${
                        isCompleted
                          ? "bg-neutral-950/70 border-neutral-800/40 opacity-75"
                          : "bg-neutral-900/60 border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/90 shadow-sm"
                      }`}
                    >
                      {/* Main Task Row */}
                      <div
                        onClick={() => toggleTaskStatus(taskId, taskInstance.status)}
                        className="flex items-center justify-between gap-3 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleTaskStatus(taskId, taskInstance.status);
                            }}
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
                              {taskInstance.rescheduledCount !== undefined &&
                                taskInstance.rescheduledCount > 0 &&
                                !isCompleted && (
                                  <span className="text-[9px] sm:text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-800/90 text-neutral-400 border border-neutral-700/60 font-mono">
                                    Shifted {taskInstance.rescheduledCount}x
                                  </span>
                                )}
                            </div>

                            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-neutral-400 font-mono">
                              <span className="truncate max-w-[120px] sm:max-w-none">{goalTitle}</span>
                              <span>•</span>
                              <span className="tabular-nums">{estimatedMinutes}m</span>
                              <span>•</span>
                              <span className="uppercase text-cyan-400/90">{energy} Energy</span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-neutral-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>

                      {/* 1-Tap Deferral Options for active tasks */}
                      {!isCompleted && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-2 pt-3 mt-3 border-t border-neutral-800/50 flex-wrap"
                        >
                          <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider">
                            Slide:
                          </span>
                          <button
                            onClick={() => handleDeferTask(taskId, 1, taskTitle)}
                            disabled={deferringTaskId === taskId}
                            title="Push this task to tomorrow. No guilt, no penalty."
                            className="px-2.5 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium transition-all active:scale-95 flex items-center gap-1"
                          >
                            <Clock className="w-3 h-3 text-cyan-400" />
                            <span>→ Tomorrow</span>
                          </button>
                          <button
                            onClick={() => handleDeferTask(taskId, getDaysToWeekend(), taskTitle)}
                            disabled={deferringTaskId === taskId}
                            title="Move to this weekend when you have more bandwidth."
                            className="px-2.5 py-1 rounded-lg bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 text-[11px] font-medium transition-all active:scale-95 flex items-center gap-1"
                          >
                            <Calendar className="w-3 h-3 text-purple-400" />
                            <span>→ Weekend</span>
                          </button>
                        </div>
                      )}

                      {/* Caring Coach Intervention (3+ Postpones) */}
                      {!isCompleted &&
                        taskInstance.rescheduledCount !== undefined &&
                        taskInstance.rescheduledCount >= 3 && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-3 p-3 rounded-xl bg-amber-950/25 border border-amber-800/40 space-y-2"
                          >
                            <div className="flex items-center gap-1.5 text-amber-300 text-xs font-semibold">
                              <span>🤝</span>
                              <span>Postponed {taskInstance.rescheduledCount} times — feeling resistance?</span>
                            </div>
                            <p className="text-[11px] text-amber-200/80 leading-snug">
                              Big tasks feel heavy when cognitive load is high. It's completely okay if it takes time. Choose what feels right:
                            </p>
                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              <button
                                onClick={() => handleShrinkTask(taskId)}
                                disabled={shrinkingTaskId === taskId}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 text-xs font-medium active:scale-95 transition-all"
                              >
                                <Zap className="w-3 h-3 text-amber-400" />
                                <span>{shrinkingTaskId === taskId ? "Shrinking..." : "⚡ 10-Min Micro-Step"}</span>
                              </button>
                              <button
                                onClick={() =>
                                  setWhyAnchorModal({
                                    isOpen: true,
                                    taskTitle,
                                    goalTitle,
                                    whyReason:
                                      taskInstance.whyReason ||
                                      "To achieve my goals and unlock full capability.",
                                    dreamVision:
                                      taskInstance.dreamVision ||
                                      "Living with mastery, calm focus, and steady momentum.",
                                    costOfInaction:
                                      taskInstance.costOfInaction ||
                                      "Remaining stuck at the same level 6 months from now.",
                                  })
                                }
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-neutral-200 text-xs font-medium active:scale-95 transition-all"
                              >
                                <Heart className="w-3 h-3 text-rose-400" />
                                <span>❤️ Remember My Why</span>
                              </button>
                            </div>
                          </div>
                        )}

                      {/* Task-to-Playbook Micro-Journaling (Completed) */}
                      {isCompleted && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-3 pt-3 border-t border-neutral-800/60"
                        >
                          {journalSavedId === taskId ? (
                            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                              <span>Technique logged to your Life Playbook vault!</span>
                            </div>
                          ) : journalInputId === taskId ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-1.5 text-xs text-neutral-300">
                                <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                                <span>What did you discover or learn during this session?</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={journalText}
                                  onChange={(e) => setJournalText(e.target.value)}
                                  placeholder="e.g. Focused on early wrist snap; felt effortless power..."
                                  className="flex-1 px-3 py-1.5 text-xs bg-neutral-950 border border-neutral-700 rounded-lg text-white placeholder-neutral-500 focus:outline-none focus:border-cyan-500"
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && journalText.trim()) {
                                      handleSaveJournal(taskId);
                                    }
                                  }}
                                />
                                <button
                                  onClick={() => handleSaveJournal(taskId)}
                                  disabled={savingJournal || !journalText.trim()}
                                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-medium transition-all active:scale-95 flex items-center gap-1 shrink-0"
                                >
                                  <span>{savingJournal ? "Saving..." : "Save"}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setJournalInputId(null);
                                    setJournalText("");
                                  }}
                                  className="px-2 py-1.5 rounded-lg text-neutral-400 hover:text-white text-xs transition-colors shrink-0"
                                >
                                  Skip
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setJournalInputId(taskId);
                                setJournalText("");
                              }}
                              className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-cyan-400 transition-colors"
                            >
                              <BookOpen className="w-3.5 h-3.5" />
                              <span>+ Log a quick lesson to your Playbook</span>
                            </button>
                          )}
                        </div>
                      )}
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
                    onClick={() => handlePullForward()}
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
                    onClick={() => {
                      if (task.id) {
                        handlePullForward(task.id);
                      }
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

      {/* Floating Undo Toast (Accidental Tap Protection) */}
      {undoToast && (
        <FloatingUndoToast
          message={undoToast.message}
          onUndo={async () => {
            const undoFn = undoToast.onUndo;
            setUndoToast(null);
            await undoFn();
          }}
          onDismiss={() => setUndoToast(null)}
          durationMs={6000}
        />
      )}

      {/* Why Anchor Modal */}
      {whyAnchorModal?.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in slide-in-from-bottom duration-200">
            {/* Grab handle on mobile */}
            <div className="w-10 h-1 rounded-full bg-neutral-700/80 mx-auto -mt-2 mb-2 sm:hidden" />
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-rose-950 border border-rose-800 flex items-center justify-center text-rose-400">
                <Heart className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Remember Your Why</h3>
                <p className="text-xs text-neutral-400">{whyAnchorModal.goalTitle}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800/80 space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">Core Purpose</span>
                <p className="text-sm text-neutral-200 leading-snug italic">"{whyAnchorModal.whyReason}"</p>
              </div>

              {whyAnchorModal.dreamVision && (
                <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-cyan-400">The Vision</span>
                  <p className="text-xs text-cyan-200/90 leading-relaxed">{whyAnchorModal.dreamVision}</p>
                </div>
              )}

              {whyAnchorModal.costOfInaction && (
                <div className="p-3 rounded-xl bg-neutral-950/40 border border-neutral-800/50 space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">If You Give Up</span>
                  <p className="text-xs text-neutral-400 leading-relaxed">{whyAnchorModal.costOfInaction}</p>
                </div>
              )}
            </div>

            <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800/60 text-center">
              <p className="text-xs text-neutral-300">
                🌱 <span className="font-semibold text-white">No rush.</span> Achieving the goal matters more than speed. Take small steps at your own pace.
              </p>
            </div>

            <div className="flex justify-end pt-1">
              <button
                onClick={() => setWhyAnchorModal(null)}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md active:scale-95 transition-all"
              >
                I'm Ready • Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
