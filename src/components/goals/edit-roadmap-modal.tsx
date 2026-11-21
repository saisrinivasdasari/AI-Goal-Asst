"use client";

import { useState, useEffect } from "react";
import {
  X,
  Save,
  Pencil,
  Plus,
  Trash2,
  Calendar,
  Layers,
  Sparkles,
  Loader2,
  Clock,
  AlertCircle,
} from "lucide-react";

interface TaskItem {
  id?: string;
  title: string;
  priority: "P0_CRITICAL" | "P1_IMPORTANT" | "P2_OPTIONAL";
  estimatedMinutes: number;
  requiredEnergy?: "HIGH_FOCUS" | "MEDIUM" | "LOW_RECOVERY";
}

interface WeeklyTargetItem {
  id?: string;
  title: string;
  targetHours: number;
  tasks: TaskItem[];
}

interface MilestoneItem {
  id?: string;
  title: string;
  targetDate?: string;
  orderIndex: number;
  weeklyTargets: WeeklyTargetItem[];
}

interface EditRoadmapModalProps {
  isOpen: boolean;
  goalId: string;
  initialData: {
    title: string;
    whyReason?: string;
    targetDate: string;
    category?: string;
    milestones: Array<{
      id: string;
      title: string;
      targetDate?: string;
      orderIndex: number;
      weeklyTargets: Array<{
        id: string;
        title: string;
        targetHours: number;
        tasks: Array<{
          id: string;
          title: string;
          priority: string;
          estimatedMinutes: number;
          energyRequired?: string;
        }>;
      }>;
    }>;
  };
  onClose: () => void;
  onUpdated: () => void;
}

export function EditRoadmapModal({
  isOpen,
  goalId,
  initialData,
  onClose,
  onUpdated,
}: EditRoadmapModalProps) {
  const [activeTab, setActiveTab] = useState<"general" | "milestones">("general");
  const [title, setTitle] = useState(initialData.title || "");
  const [whyReason, setWhyReason] = useState(initialData.whyReason || "");
  const [targetDate, setTargetDate] = useState(
    initialData.targetDate ? initialData.targetDate.split("T")[0] : ""
  );
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when initialData changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || "");
      setWhyReason(initialData.whyReason || "");
      setTargetDate(initialData.targetDate ? initialData.targetDate.split("T")[0] : "");

      const formattedMilestones: MilestoneItem[] = (initialData.milestones || []).map((m, mIdx) => ({
        id: m.id,
        title: m.title,
        orderIndex: m.orderIndex || mIdx + 1,
        targetDate: m.targetDate ? m.targetDate.split("T")[0] : undefined,
        weeklyTargets: (m.weeklyTargets || []).map((wt) => ({
          id: wt.id,
          title: wt.title,
          targetHours: wt.targetHours || 5,
          tasks: (wt.tasks || []).map((t) => ({
            id: t.id,
            title: t.title,
            priority: (t.priority as any) || "P1_IMPORTANT",
            estimatedMinutes: t.estimatedMinutes || 45,
            requiredEnergy: (t.energyRequired as any) || "HIGH_FOCUS",
          })),
        })),
      }));

      setMilestones(formattedMilestones);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleMilestoneTitleChange = (mIdx: number, newTitle: string) => {
    setMilestones((prev) => {
      const copy = [...prev];
      copy[mIdx] = { ...copy[mIdx], title: newTitle };
      return copy;
    });
  };

  const handleWeeklyTargetTitleChange = (mIdx: number, wIdx: number, newTitle: string) => {
    setMilestones((prev) => {
      const copy = [...prev];
      const targets = [...copy[mIdx].weeklyTargets];
      targets[wIdx] = { ...targets[wIdx], title: newTitle };
      copy[mIdx] = { ...copy[mIdx], weeklyTargets: targets };
      return copy;
    });
  };

  const handleTaskTitleChange = (mIdx: number, wIdx: number, tIdx: number, newTitle: string) => {
    setMilestones((prev) => {
      const copy = [...prev];
      const targets = [...copy[mIdx].weeklyTargets];
      const tasks = [...targets[wIdx].tasks];
      tasks[tIdx] = { ...tasks[tIdx], title: newTitle };
      targets[wIdx] = { ...targets[wIdx], tasks };
      copy[mIdx] = { ...copy[mIdx], weeklyTargets: targets };
      return copy;
    });
  };

  const handleTaskPriorityChange = (
    mIdx: number,
    wIdx: number,
    tIdx: number,
    newPriority: "P0_CRITICAL" | "P1_IMPORTANT" | "P2_OPTIONAL"
  ) => {
    setMilestones((prev) => {
      const copy = [...prev];
      const targets = [...copy[mIdx].weeklyTargets];
      const tasks = [...targets[wIdx].tasks];
      tasks[tIdx] = { ...tasks[tIdx], priority: newPriority };
      targets[wIdx] = { ...targets[wIdx], tasks };
      copy[mIdx] = { ...copy[mIdx], weeklyTargets: targets };
      return copy;
    });
  };

  const handleAddTask = (mIdx: number, wIdx: number) => {
    setMilestones((prev) => {
      const copy = [...prev];
      const targets = [...copy[mIdx].weeklyTargets];
      const tasks = [
        ...targets[wIdx].tasks,
        {
          title: "New Focused Task",
          priority: "P1_IMPORTANT" as const,
          estimatedMinutes: 45,
          requiredEnergy: "HIGH_FOCUS" as const,
        },
      ];
      targets[wIdx] = { ...targets[wIdx], tasks };
      copy[mIdx] = { ...copy[mIdx], weeklyTargets: targets };
      return copy;
    });
  };

  const handleRemoveTask = (mIdx: number, wIdx: number, tIdx: number) => {
    setMilestones((prev) => {
      const copy = [...prev];
      const targets = [...copy[mIdx].weeklyTargets];
      const tasks = targets[wIdx].tasks.filter((_, idx) => idx !== tIdx);
      targets[wIdx] = { ...targets[wIdx], tasks };
      copy[mIdx] = { ...copy[mIdx], weeklyTargets: targets };
      return copy;
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Goal title cannot be empty");
      return;
    }

    try {
      setIsSaving(true);
      setError(null);

      const res = await fetch(`/api/v1/goals/${goalId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          whyReason: whyReason.trim(),
          targetDate: targetDate || undefined,
          milestones,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to update roadmap");
      }

      onUpdated();
      onClose();
    } catch (err: any) {
      console.error("Failed to save goal updates:", err);
      setError(err.message || "Failed to save roadmap adjustments");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-neutral-950 border border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Pencil className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Edit Roadmap & Horizons
              </h2>
              <p className="text-xs text-neutral-400">
                Tailor milestones, weekly focus targets, and tasks to your evolving reality.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="text-neutral-500 hover:text-neutral-300 p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-900/20 px-6 shrink-0">
          <button
            onClick={() => setActiveTab("general")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "general"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Goal Profile & Why</span>
          </button>
          <button
            onClick={() => setActiveTab("milestones")}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-all flex items-center gap-2 ${
              activeTab === "milestones"
                ? "border-cyan-400 text-cyan-300"
                : "border-transparent text-neutral-400 hover:text-neutral-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Milestones & Tasks ({milestones.length})</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/50 flex items-center gap-2 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {activeTab === "general" ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  Goal Title / Horizon Outcome
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900 border border-neutral-800 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  Emotional Core & Why (Anchor)
                </label>
                <textarea
                  rows={3}
                  value={whyReason}
                  onChange={(e) => setWhyReason(e.target.value)}
                  placeholder="Why is achieving this goal deeply meaningful to you?"
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white placeholder-neutral-600 focus:outline-none focus:border-cyan-500 transition-colors resize-none leading-relaxed"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Target Arrival Date</span>
                </label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {milestones.map((m, mIdx) => (
                <div
                  key={m.id || mIdx}
                  className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-cyan-400 font-semibold px-2 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 shrink-0">
                      Phase {mIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={m.title}
                      onChange={(e) => handleMilestoneTitleChange(mIdx, e.target.value)}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-neutral-950/70 border border-neutral-800 text-xs font-semibold text-white focus:outline-none focus:border-cyan-500"
                    />
                  </div>

                  {/* Weekly Targets inside this milestone */}
                  <div className="space-y-3 pl-3 border-l-2 border-neutral-800/70">
                    {m.weeklyTargets.map((wt, wIdx) => (
                      <div
                        key={wt.id || wIdx}
                        className="p-3 rounded-lg bg-neutral-950/50 border border-neutral-800/60 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="text"
                            value={wt.title}
                            onChange={(e) =>
                              handleWeeklyTargetTitleChange(mIdx, wIdx, e.target.value)
                            }
                            className="flex-1 px-2.5 py-1 rounded bg-neutral-900 border border-neutral-800 text-[11px] font-medium text-neutral-300 focus:outline-none focus:border-cyan-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddTask(mIdx, wIdx)}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-400 hover:text-cyan-300 px-2 py-1 rounded bg-cyan-950/50 border border-cyan-800/50 hover:bg-cyan-900/40 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Add Task</span>
                          </button>
                        </div>

                        {/* Task List */}
                        <div className="space-y-1.5">
                          {wt.tasks.map((t, tIdx) => (
                            <div
                              key={t.id || tIdx}
                              className="flex items-center gap-2 p-1.5 rounded bg-neutral-900/70 border border-neutral-800/50 text-xs"
                            >
                              <input
                                type="text"
                                value={t.title}
                                onChange={(e) =>
                                  handleTaskTitleChange(mIdx, wIdx, tIdx, e.target.value)
                                }
                                className="flex-1 px-2 py-1 rounded bg-transparent text-xs text-neutral-200 focus:outline-none focus:bg-neutral-950/60"
                              />

                              <select
                                value={t.priority}
                                onChange={(e) =>
                                  handleTaskPriorityChange(mIdx, wIdx, tIdx, e.target.value as any)
                                }
                                className="px-1.5 py-0.5 rounded bg-neutral-950 border border-neutral-800 text-[10px] font-mono text-neutral-400 focus:outline-none"
                              >
                                <option value="P0_CRITICAL">P0 Critical</option>
                                <option value="P1_IMPORTANT">P1 Important</option>
                                <option value="P2_OPTIONAL">P2 Optional</option>
                              </select>

                              <button
                                type="button"
                                onClick={() => handleRemoveTask(mIdx, wIdx, tIdx)}
                                className="text-neutral-500 hover:text-rose-400 p-1 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-neutral-800 bg-neutral-900/40 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 shadow-lg shadow-cyan-600/20 transition-all"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Changes...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Roadmap Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

