"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Target,
  Plus,
  Calendar,
  Sparkles,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Flame,
  CheckCircle,
  Compass,
  Layers,
  Clock,
  Trash2,
} from "lucide-react";
import { RoadmapStudioModal } from "@/components/goals/roadmap-studio-modal";
import { DeleteGoalModal } from "@/components/goals/delete-goal-modal";
import { GoogleCalendarView } from "@/components/calendar/google-calendar-view";

interface Goal {
  id: string;
  title: string;
  category?: string;
  lifeArea?: { name: string };
  status: string;
  targetDate: string;
  whyReason?: string;
  whyStatement?: string;
  milestones: {
    id: string;
    title: string;
    completedAt?: string | null;
    weeklyTargets: {
      id: string;
      tasks: {
        id: string;
        instances?: { status: string }[];
        taskInstances?: { status: string }[];
      }[];
    }[];
  }[];
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [goalToDelete, setGoalToDelete] = useState<{ id: string; title: string } | null>(null);
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarGoal, setCalendarGoal] = useState<{ id: string; title: string } | null>(null);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/v1/goals");
      const json = await res.json();
      const list = json.data || json.goals || [];
      setGoals(list);
    } catch (err) {
      console.error("Failed to load goals:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const calculateProgress = (goal: Goal) => {
    let totalTasks = 0;
    let completedTasks = 0;
    goal.milestones?.forEach((m) => {
      m.weeklyTargets?.forEach((w) => {
        w.tasks?.forEach((t) => {
          const list = t.instances || t.taskInstances || [];
          list.forEach((ti) => {
            totalTasks++;
            if (ti.status === "COMPLETED") completedTasks++;
          });
        });
      });
    });
    return totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider">
            <Target className="w-4 h-4" />
            <span>Goal Architecture & Horizons</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Active Horizons</h1>
          <p className="text-xs text-neutral-400">
            High-leverage life outcomes broken down into autonomous milestones.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={() => setShowCalendarModal(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 hover:border-cyan-500/50 text-xs font-semibold shadow-md transition-all"
          >
            <Calendar className="w-4 h-4 text-cyan-400" />
            <span>Calendar Schedule</span>
          </button>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Architect New Goal</span>
          </button>
        </div>
      </div>

      {/* Goals Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 animate-pulse">
          <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800/80 h-52" />
          <div className="p-6 rounded-2xl bg-neutral-900/50 border border-neutral-800/80 h-52" />
        </div>
      ) : goals.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {goals.map((goal) => {
            const progress = calculateProgress(goal);
            return (
              <Link
                key={goal.id}
                href={`/goals/${goal.id}`}
                className="group p-4 sm:p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/90 active:scale-[0.99] transition-all space-y-4 sm:space-y-5 flex flex-col justify-between shadow-lg relative overflow-hidden"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase px-2.5 py-0.5 rounded-md bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-mono">
                      {goal.lifeArea?.name || goal.category || "CAREER"}
                    </span>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <span className="text-[11px] sm:text-xs text-neutral-400 font-mono flex items-center gap-1.5 tabular-nums">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(goal.targetDate).toLocaleDateString()}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setCalendarGoal({ id: goal.id, title: goal.title });
                        }}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-cyan-400 hover:bg-cyan-950/40 transition-colors"
                        title="View Goal Calendar"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setGoalToDelete({ id: goal.id, title: goal.title });
                        }}
                        className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                        title="Delete Roadmap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-cyan-300 transition-colors">
                    {goal.title}
                  </h3>

                  <p className="text-xs text-neutral-400 line-clamp-2 italic leading-relaxed text-pretty">
                    "{goal.whyReason || goal.whyStatement || "Core focus area"}"
                  </p>
                </div>

                <div className="space-y-2.5 pt-3 border-t border-neutral-800/60">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-neutral-400">Milestone Progress</span>
                    <span className="text-cyan-400 font-semibold tabular-nums">{progress}%</span>
                  </div>

                  <div className="w-full h-1.5 rounded-full bg-neutral-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500 rounded-full"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-neutral-500 font-mono">
                      {goal.milestones?.length || 0} Milestones
                    </span>
                    <div className="flex items-center gap-1 text-xs text-cyan-400 font-medium group-hover:translate-x-0.5 transition-transform">
                      <span>View Roadmap</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="p-16 text-center rounded-2xl bg-neutral-900/30 border border-dashed border-neutral-800 space-y-4">
          <Target className="w-10 h-10 text-neutral-600 mx-auto" />
          <h3 className="text-base font-semibold text-neutral-200">No Goals Created Yet</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Give Jarvis a high-level outcome. Our hierarchical AI engine will automatically decompose
            it into milestones, weekly targets, and daily tasks.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Your First Goal</span>
          </button>
        </div>
      )}

      {/* Interactive Roadmap Studio Modal */}
      <RoadmapStudioModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onGoalCreated={fetchGoals}
      />

      {/* Delete Confirmation Modal with Type Check */}
      {goalToDelete && (
        <DeleteGoalModal
          isOpen={!!goalToDelete}
          goalId={goalToDelete.id}
          goalTitle={goalToDelete.title}
          onClose={() => setGoalToDelete(null)}
          onDeleted={() => {
            setGoalToDelete(null);
            fetchGoals();
          }}
        />
      )}

      {/* Google Calendar Schedule Modal (All Goals) */}
      {showCalendarModal && (
        <GoogleCalendarView
          isModal
          onClose={() => setShowCalendarModal(false)}
        />
      )}

      {/* Google Calendar Schedule Modal (Specific Goal) */}
      {calendarGoal && (
        <GoogleCalendarView
          isModal
          goalId={calendarGoal.id}
          goalTitle={calendarGoal.title}
          onClose={() => setCalendarGoal(null)}
        />
      )}
    </div>
  );
}

