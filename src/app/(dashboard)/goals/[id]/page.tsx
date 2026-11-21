"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Target,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  Flame,
  AlertTriangle,
  RefreshCw,
  Layers,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { DeleteGoalModal } from "@/components/goals/delete-goal-modal";
import { EditRoadmapModal } from "@/components/goals/edit-roadmap-modal";
import { GoogleCalendarView } from "@/components/calendar/google-calendar-view";

interface GoalJourney {
  goalId: string;
  title: string;
  whyReason?: string;
  category: string;
  targetDate: string;
  estimatedCompletionDate: string;
  paceStatus: "ON_TRACK" | "AT_RISK" | "BEHIND" | "AHEAD_OF_PACE" | "BEHIND_PACE";
  overallProgressPercent?: number;
  overallProgress?: number;
  milestones: {
    id: string;
    title: string;
    orderIndex: number;
    isCompleted?: boolean;
    isAchieved?: boolean;
    targetDate?: string;
    progressPct?: number;
    weeklyTargets: {
      id: string;
      weekNumber: number;
      title: string;
      targetHours: number;
      isCompleted?: boolean;
      tasks: {
        id: string;
        title: string;
        priority: string;
        estimatedMinutes: number;
        energyRequired?: string;
        taskInstances?: {
          id: string;
          scheduledDate: string;
          status: string;
        }[];
        instances?: {
          id: string;
          scheduledDate: string;
          status: string;
        }[];
      }[];
    }[];
  }[];
}

export default function GoalJourneyPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = params?.id as string;

  const [journey, setJourney] = useState<GoalJourney | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMilestones, setExpandedMilestones] = useState<Record<string, boolean>>({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [viewMode, setViewMode] = useState<"tree" | "calendar">("tree");

  const fetchJourney = async () => {
    if (!goalId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/v1/goals/${goalId}/journey`);
      const json = await res.json();
      if (json.success && (json.data || json.journey)) {
        const data = json.data || json.journey;
        setJourney(data);
        // Expand all by default
        const initExpanded: Record<string, boolean> = {};
        data.milestones?.forEach((m: any) => {
          initExpanded[m.id] = true;
        });
        setExpandedMilestones(initExpanded);
      }
    } catch (err) {
      console.error("Failed to load journey:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJourney();
  }, [goalId]);

  const toggleMilestone = (milestoneId: string) => {
    setExpandedMilestones((prev) => ({
      ...prev,
      [milestoneId]: !prev[milestoneId],
    }));
  };

  if (loading || !journey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-sm font-mono text-neutral-400">Loading Goal Journey Tree...</p>
      </div>
    );
  }

  const getPaceBadge = (status: string) => {
    switch (status) {
      case "ON_TRACK":
        return {
          label: "On Track",
          color: "bg-emerald-950/70 text-emerald-400 border-emerald-800/60",
        };
      case "AHEAD_OF_PACE":
        return {
          label: "Ahead of Pace",
          color: "bg-cyan-950/70 text-cyan-400 border-cyan-800/60",
        };
      case "AT_RISK":
        return {
          label: "At Risk",
          color: "bg-amber-950/70 text-amber-400 border-amber-800/60",
        };
      default:
        return {
          label: "Behind Schedule",
          color: "bg-rose-950/70 text-rose-400 border-rose-800/60",
        };
    }
  };

  const pace = getPaceBadge(journey.paceStatus || "ON_TRACK");
  const overallPct =
    journey.overallProgressPercent !== undefined
      ? journey.overallProgressPercent
      : journey.overallProgress !== undefined
      ? journey.overallProgress
      : 0;

  return (
    <div className="space-y-8">
      {/* Navigation & Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Link
            href="/goals"
            className="inline-flex items-center gap-2 text-xs font-mono text-neutral-400 hover:text-cyan-400 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to All Goals</span>
          </Link>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCalendarModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-cyan-300 border border-neutral-700/80 hover:border-cyan-500/50 text-xs font-medium transition-all"
            >
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Calendar View</span>
            </button>
            <button
              onClick={() => setShowEditModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-cyan-300 border border-neutral-700/80 hover:border-cyan-500/50 text-xs font-medium transition-all"
            >
              <Pencil className="w-3.5 h-3.5 text-cyan-400" />
              <span>Edit Roadmap</span>
            </button>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 hover:text-rose-200 border border-rose-800/50 hover:border-rose-600/80 text-xs font-medium transition-all"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-mono">
                {journey.category || "HORIZON"}
              </span>
              <span className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full border font-mono ${pace.color}`}>
                {pace.label}
              </span>
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight">{journey.title}</h1>

            {journey.whyReason && (
              <p className="text-xs text-neutral-400 italic max-w-xl leading-relaxed">
                "{journey.whyReason}"
              </p>
            )}

            <div className="flex items-center gap-4 text-xs font-mono text-neutral-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                Target: {new Date(journey.targetDate).toLocaleDateString()}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                Est. ETA: {new Date(journey.estimatedCompletionDate || journey.targetDate).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="text-right flex flex-col items-end justify-between self-stretch">
            <div>
              <div className="text-3xl font-bold font-mono text-cyan-400">
                {overallPct}%
              </div>
              <p className="text-[11px] text-neutral-400 font-mono">Overall Completion</p>
            </div>
          </div>
        </div>
      </div>

      {/* View Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode("tree")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewMode === "tree"
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Execution Tree</span>
          </button>
          <button
            onClick={() => setViewMode("calendar")}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              viewMode === "calendar"
                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Google Calendar View</span>
          </button>
        </div>

        <span className="text-xs font-mono text-neutral-500 hidden sm:inline">
          {viewMode === "tree"
            ? `${(journey.milestones || []).length} Milestones Total`
            : "Month View"}
        </span>
      </div>

      {viewMode === "calendar" ? (
        <div className="min-h-[600px]">
          <GoogleCalendarView goalId={goalId} goalTitle={journey.title} />
        </div>
      ) : (
        /* Roadmap Tree */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Decomposed Execution Tree</span>
            </h2>
            <span className="text-xs font-mono text-neutral-500">
              {(journey.milestones || []).length} Milestones Total
            </span>
          </div>

          <div className="space-y-4">
            {(journey.milestones || []).map((milestone, mIdx) => {
              const isExpanded = expandedMilestones[milestone.id];
              const isAchieved = milestone.isCompleted || milestone.isAchieved;

              return (
                <div
                  key={milestone.id}
                  className="rounded-2xl bg-neutral-900/40 border border-neutral-800 overflow-hidden"
                >
                  {/* Milestone Header */}
                  <div
                    onClick={() => toggleMilestone(milestone.id)}
                    className="p-5 flex items-center justify-between cursor-pointer hover:bg-neutral-900/70 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <button className="text-neutral-500">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-cyan-400">
                            Phase {mIdx + 1}:
                          </span>
                          <h3 className="text-sm font-semibold text-neutral-200">
                            {milestone.title}
                          </h3>
                          {isAchieved && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="text-xs font-mono text-neutral-500">
                      {(milestone.weeklyTargets || []).length} Weekly Targets
                    </span>
                  </div>

                  {/* Weekly Targets & Tasks (Children) */}
                  {isExpanded && (
                    <div className="px-6 pb-6 pt-2 space-y-4 border-t border-neutral-800/40 bg-neutral-950/30">
                      {(milestone.weeklyTargets || []).map((target) => (
                        <div
                          key={target.id}
                          className="p-4 rounded-xl bg-neutral-900/50 border border-neutral-800/70 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-neutral-300">
                              Week {target.weekNumber}: {target.title}
                            </span>
                            <span className="text-[11px] font-mono text-neutral-500">
                              Budget: {target.targetHours}h
                            </span>
                          </div>

                          {/* Task List */}
                          <div className="space-y-2 pl-2">
                            {(target.tasks || []).map((task) => {
                              const isP0 = task.priority === "P0_CRITICAL";
                              const instances = (task as any).taskInstances || (task as any).instances || [];
                              const completedInstance = instances.find(
                                (ti: any) => ti.status === "COMPLETED"
                              );

                              return (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-neutral-950/60 border border-neutral-800/40"
                                >
                                  <div className="flex items-center gap-2.5">
                                    {completedInstance ? (
                                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                    ) : (
                                      <Circle className="w-4 h-4 text-neutral-600 shrink-0" />
                                    )}
                                    <span
                                      className={`${
                                        completedInstance
                                          ? "line-through text-neutral-500"
                                          : "text-neutral-300"
                                      }`}
                                    >
                                      {task.title}
                                    </span>
                                    {isP0 && (
                                      <span className="text-[9px] font-semibold px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-400 border border-rose-800/60">
                                        P0
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-500">
                                    <span>{task.estimatedMinutes}m</span>
                                    <span>•</span>
                                    <span className="text-cyan-400/70">
                                      {task.energyRequired || "HIGH_FOCUS"}
                                    </span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal with Type Check */}
      <DeleteGoalModal
        isOpen={showDeleteModal}
        goalId={journey.goalId}
        goalTitle={journey.title}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={() => {
          setShowDeleteModal(false);
          router.push("/goals");
        }}
      />

      {/* Edit Roadmap Modal */}
      <EditRoadmapModal
        isOpen={showEditModal}
        goalId={journey.goalId}
        initialData={journey as any}
        onClose={() => setShowEditModal(false)}
        onUpdated={fetchJourney}
      />

      {/* Google Calendar Modal */}
      {showCalendarModal && (
        <GoogleCalendarView
          isModal
          goalId={journey.goalId}
          goalTitle={journey.title}
          onClose={() => setShowCalendarModal(false)}
        />
      )}
    </div>
  );
}
