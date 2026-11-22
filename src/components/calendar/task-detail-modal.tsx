"use client";

import { useState } from "react";
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  Zap,
  CheckCircle2,
  Circle,
  Flame,
  Layers,
  ArrowRight,
  Loader2,
  MoveRight,
} from "lucide-react";
import Link from "next/link";
import { CalendarTaskDTO } from "@/features/calendar/calendar.service";

interface TaskDetailModalProps {
  task: CalendarTaskDTO | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

export function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
}: TaskDetailModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [editDate, setEditDate] = useState<string>("");
  const [showReschedule, setShowReschedule] = useState(false);

  if (!isOpen || !task) return null;

  const isCompleted = task.status === "COMPLETED";

  const handleToggleComplete = async () => {
    try {
      setIsUpdating(true);
      const newStatus = isCompleted ? "PENDING" : "COMPLETED";
      const res = await fetch(`/api/v1/calendar/task/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        task.status = newStatus;
        onTaskUpdated?.();
      }
    } catch (err) {
      console.error("Failed to toggle task completion:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReschedule = async () => {
    if (!editDate) return;
    try {
      setIsUpdating(true);
      const res = await fetch(`/api/v1/calendar/task/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledDate: editDate }),
      });
      const data = await res.json();
      if (data.success) {
        task.scheduledDate = editDate;
        setShowReschedule(false);
        onTaskUpdated?.();
        onClose();
      }
    } catch (err) {
      console.error("Failed to reschedule task:", err);
    } finally {
      setIsUpdating(false);
    }
  };

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "P0_CRITICAL":
        return {
          label: "P0 Critical",
          color: "bg-rose-950/80 text-rose-300 border-rose-800/80",
          icon: Flame,
        };
      case "P1_IMPORTANT":
        return {
          label: "P1 Important",
          color: "bg-amber-950/80 text-amber-300 border-amber-800/80",
          icon: Zap,
        };
      default:
        return {
          label: "P2 Optional",
          color: "bg-cyan-950/80 text-cyan-300 border-cyan-800/80",
          icon: Circle,
        };
    }
  };

  const priority = getPriorityBadge(task.priority);
  const PriorityIcon = priority.icon;

  const formattedDate = new Date(task.scheduledDate + "T00:00:00").toLocaleDateString(
    undefined,
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-neutral-950 border-t sm:border border-neutral-800 shadow-2xl p-5 sm:p-6 space-y-5 sm:space-y-6 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Grab Handle for mobile */}
        <div className="w-10 h-1 rounded-full bg-neutral-700/80 mx-auto -mt-1 sm:hidden shrink-0" />
        {/* Header Badges & Close */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 font-mono">
              {task.goalCategory}
            </span>
            <span
              className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full border font-mono flex items-center gap-1 ${priority.color}`}
            >
              <PriorityIcon className="w-3 h-3" />
              <span>{priority.label}</span>
            </span>
            <span
              className={`text-[10px] font-semibold uppercase px-2.5 py-1 rounded-full border font-mono ${
                isCompleted
                  ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/80"
                  : "bg-neutral-900 text-neutral-400 border-neutral-800"
              }`}
            >
              {isCompleted ? "Completed" : "Scheduled"}
            </span>
          </div>

          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-neutral-300 p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Full Task Title */}
        <div className="space-y-1.5">
          <h2
            className={`text-lg font-bold tracking-tight text-white ${
              isCompleted ? "line-through text-neutral-400" : ""
            }`}
          >
            {task.title}
          </h2>
          {task.description && (
            <p className="text-xs text-neutral-400 leading-relaxed">
              {task.description}
            </p>
          )}
        </div>

        {/* Roadmap Hierarchy Context */}
        <div className="p-3.5 rounded-xl bg-neutral-900/60 border border-neutral-800/80 space-y-2">
          <div className="text-[11px] font-mono text-cyan-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Goal Roadmap Alignment</span>
          </div>
          <div className="text-xs text-neutral-300 font-medium space-y-1">
            <div className="flex items-center gap-2 text-neutral-200">
              <span className="text-neutral-500 font-mono text-[11px]">Goal:</span>
              <span className="font-semibold">{task.goalTitle}</span>
            </div>
            <div className="flex items-center gap-2 text-neutral-400 text-[11px]">
              <span className="text-neutral-500 font-mono">Phase:</span>
              <span>{task.milestoneTitle}</span>
              <span>•</span>
              <span>{task.weeklyTargetTitle}</span>
            </div>
          </div>
        </div>

        {/* Task Meta Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/60 space-y-1">
            <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
              <CalendarIcon className="w-3 h-3 text-cyan-400" />
              <span>Date</span>
            </span>
            <p className="text-xs font-semibold text-neutral-200 truncate">
              {task.scheduledDate}
            </p>
          </div>

          <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/60 space-y-1">
            <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>Duration</span>
            </span>
            <p className="text-xs font-semibold text-neutral-200">
              {task.estimatedMinutes} mins
            </p>
          </div>

          <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/60 space-y-1 col-span-2 sm:col-span-1">
            <span className="text-[10px] font-mono text-neutral-500 flex items-center gap-1">
              <Zap className="w-3 h-3 text-cyan-400" />
              <span>Energy Slot</span>
            </span>
            <p className="text-xs font-semibold text-neutral-200">
              {task.requiredEnergy}
            </p>
          </div>
        </div>

        {/* Reschedule Drawer (Toggleable) */}
        {showReschedule && (
          <div className="p-3.5 rounded-xl bg-neutral-900 border border-neutral-700 space-y-3 animate-in fade-in">
            <span className="text-xs font-medium text-neutral-300">
              Pick a new date for this task:
            </span>
            <div className="flex items-center gap-2">
              <input
                type="date"
                defaultValue={task.scheduledDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950 border border-neutral-700 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleReschedule}
                disabled={isUpdating || !editDate}
                className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-neutral-800/60">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleToggleComplete}
              disabled={isUpdating}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                isCompleted
                  ? "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-700"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20"
              }`}
            >
              {isUpdating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : isCompleted ? (
                <>
                  <Circle className="w-3.5 h-3.5" />
                  <span>Mark Incomplete</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Mark Complete</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowReschedule(!showReschedule)}
              className="px-3 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 transition-colors"
            >
              Move Date
            </button>
          </div>

          <Link
            href={`/goals/${task.goalId}`}
            onClick={onClose}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 text-xs font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            <span>Open Goal Roadmap</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}

