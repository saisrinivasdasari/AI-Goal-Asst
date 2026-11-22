"use client";

import { useState } from "react";
import {
  Sparkles,
  Calendar,
  Clock,
  Compass,
  CheckCircle2,
  Trash2,
  Plus,
  ArrowRight,
  ArrowLeft,
  Flame,
  Zap,
  RefreshCw,
  X,
  Target,
  Layers,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface TaskDraft {
  title: string;
  description?: string;
  priority: "P0_CRITICAL" | "P1_IMPORTANT" | "P2_OPTIONAL";
  estimatedMinutes: number;
  requiredEnergy: "HIGH_FOCUS" | "MEDIUM" | "LOW_RECOVERY";
}

interface WeeklyTargetDraft {
  title: string;
  targetHours: number;
  tasks: TaskDraft[];
}

interface MilestoneDraft {
  title: string;
  description?: string;
  orderIndex: number;
  estimatedWeeksFromStart: number;
  weeklyTargets: WeeklyTargetDraft[];
}

interface PreviewRoadmapData {
  title: string;
  category: string;
  durationWeeks: number;
  weeklyHours: number;
  targetDate: string;
  whyReason: string;
  whyNow: string;
  costOfInaction: string;
  milestones: MilestoneDraft[];
}

interface RoadmapStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoalCreated: () => void;
}

export function RoadmapStudioModal({
  isOpen,
  onClose,
  onGoalCreated,
}: RoadmapStudioModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [synthesizing, setSynthesizing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCustomSyllabus, setShowCustomSyllabus] = useState(false);

  // Step 1 Form state
  const [formData, setFormData] = useState({
    title: "",
    category: "CAREER",
    durationWeeks: 4,
    weeklyHours: 8,
    whyStatement: "",
    whyNowStatement: "",
    inactionCostStatement: "",
    customRoadmapText: "",
  });

  // Step 2 Preview & Customization state
  const [roadmap, setRoadmap] = useState<PreviewRoadmapData | null>(null);

  if (!isOpen) return null;

  const handleSynthesize = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSynthesizing(true);
      setError(null);

      const res = await fetch("/api/v1/goals/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.title,
          category: formData.category,
          durationWeeks: formData.durationWeeks,
          weeklyHours: formData.weeklyHours,
          whyReason: formData.whyStatement,
          whyNow: formData.whyNowStatement,
          costOfInaction: formData.inactionCostStatement,
          customRoadmapText: formData.customRoadmapText.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || "Failed to generate roadmap preview");
      }

      setRoadmap(json.data);
      setStep(2);
    } catch (err: any) {
      let msg = err.message || "An unexpected error occurred";
      if (msg.includes("Can't reach database server") || msg.includes("PrismaClientInitializationError")) {
        msg = "Unable to connect to the database. Please verify your Supabase Connection Pooler settings.";
      }
      setError(msg);
    } finally {
      setSynthesizing(false);
    }
  };

  const handleConfirm = async () => {
    if (!roadmap) return;
    try {
      setConfirming(true);
      setError(null);

      const res = await fetch("/api/v1/goals/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: roadmap.title,
          category: roadmap.category,
          targetDate: roadmap.targetDate,
          estimatedHoursTotal: roadmap.durationWeeks * roadmap.weeklyHours,
          whyReason: roadmap.whyReason,
          whyNow: roadmap.whyNow,
          costOfInaction: roadmap.costOfInaction,
          milestones: roadmap.milestones,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error?.message || "Failed to confirm and schedule roadmap");
      }

      onGoalCreated();
      onClose();
    } catch (err: any) {
      let msg = err.message || "Failed to confirm roadmap";
      if (msg.includes("Can't reach database server") || msg.includes("PrismaClientInitializationError")) {
        msg = "Unable to connect to the database. Please verify your Supabase Connection Pooler settings.";
      }
      setError(msg);
    } finally {
      setConfirming(false);
    }
  };

  // Editing helpers for Step 2
  const updateMilestoneTitle = (mIdx: number, newTitle: string) => {
    if (!roadmap) return;
    const updated = { ...roadmap };
    updated.milestones[mIdx].title = newTitle;
    setRoadmap(updated);
  };

  const deleteTask = (mIdx: number, tIdx: number, taskIdx: number) => {
    if (!roadmap) return;
    const updated = { ...roadmap };
    updated.milestones[mIdx].weeklyTargets[tIdx].tasks.splice(taskIdx, 1);
    setRoadmap(updated);
  };

  const addTask = (mIdx: number, tIdx: number) => {
    if (!roadmap) return;
    const updated = { ...roadmap };
    updated.milestones[mIdx].weeklyTargets[tIdx].tasks.push({
      title: "New Custom Mission Task",
      priority: "P1_IMPORTANT",
      estimatedMinutes: 45,
      requiredEnergy: "MEDIUM",
    });
    setRoadmap(updated);
  };

  const formatTargetDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-3xl rounded-t-3xl sm:rounded-2xl bg-neutral-900 border-t sm:border border-neutral-800 shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-[85vh] flex flex-col my-0 sm:my-8 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Grab Handle on mobile */}
        <div className="w-10 h-1 rounded-full bg-neutral-700/80 mx-auto mt-2.5 -mb-1 sm:hidden shrink-0" />
        {/* Top Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="w-8 sm:w-9 h-8 sm:h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
              <Compass className="w-4 sm:w-5 h-4 sm:w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
                  Goal Traveler Studio
                </h2>
                <span className="text-[9px] sm:text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300">
                  {step === 1 ? "Step 1" : "Step 2"}
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-neutral-400">
                {step === 1
                  ? "Define your dream, time horizon, and emotional anchors."
                  : "Inspect, tweak, and personalize your journey tree."}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 sm:w-8 h-7 sm:h-8 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-950/50 border border-rose-800 text-rose-300 text-xs">
            {error}
          </div>
        )}

        {/* STEP 1: INTENT & HORIZON */}
        {step === 1 && (
          <form onSubmit={handleSynthesize} className="p-6 space-y-5">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-200">
                What goal or skill are you traveling towards?
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Master High-Probability Options Trading"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-sm focus:outline-none focus:border-cyan-500 font-medium placeholder:text-neutral-600"
              />
            </div>

            {/* Category & Hours Commitment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-neutral-200">Life Domain</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-sm focus:outline-none focus:border-cyan-500 font-medium"
                >
                  <option value="CAREER">Career & Technology</option>
                  <option value="WEALTH">Wealth & Finance</option>
                  <option value="HEALTH">Health & Fitness</option>
                  <option value="LEARNING">Deep Learning & Mastery</option>
                  <option value="CREATIVE">Creative Projects</option>
                  <option value="LIFESTYLE">Lifestyle & Mindset</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-200">
                    Weekly Commitment
                  </label>
                  <span className="text-xs font-mono text-cyan-400 font-bold">
                    {formData.weeklyHours} hrs/week
                  </span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="25"
                  step="1"
                  value={formData.weeklyHours}
                  onChange={(e) =>
                    setFormData({ ...formData, weeklyHours: parseInt(e.target.value) })
                  }
                  className="w-full accent-cyan-500 cursor-pointer"
                />
                <p className="text-[10px] text-neutral-500">
                  ~{(formData.weeklyHours / 7).toFixed(1)} hrs/day across your active energy slots.
                </p>
              </div>
            </div>

            {/* Flexible Horizon Presets */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span>Select Time Horizon (Flexible Duration)</span>
                <span className="text-[11px] font-mono text-cyan-400">
                  {formData.durationWeeks} Weeks Target
                </span>
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  {
                    weeks: 2,
                    label: "2 Weeks",
                    subtitle: "Fast Sprint",
                    icon: Zap,
                    color: "border-amber-700/60 bg-amber-950/20 text-amber-300",
                  },
                  {
                    weeks: 4,
                    label: "1 Month",
                    subtitle: "Fast Track",
                    icon: Clock,
                    color: "border-blue-700/60 bg-blue-950/20 text-blue-300",
                  },
                  {
                    weeks: 12,
                    label: "3 Months",
                    subtitle: "Quarter Mountain",
                    icon: Target,
                    color: "border-cyan-700/60 bg-cyan-950/20 text-cyan-300",
                  },
                  {
                    weeks: 16,
                    label: "4 Months",
                    subtitle: "Deep Mastery",
                    icon: Layers,
                    color: "border-purple-700/60 bg-purple-950/20 text-purple-300",
                  },
                ].map((preset) => {
                  const isSelected = formData.durationWeeks === preset.weeks;
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.weeks}
                      type="button"
                      onClick={() => setFormData({ ...formData, durationWeeks: preset.weeks })}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "bg-cyan-950/60 border-cyan-500 shadow-md shadow-cyan-500/10"
                          : "bg-neutral-950 border-neutral-800 hover:border-neutral-700 text-neutral-400"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`w-3.5 h-3.5 ${isSelected ? "text-cyan-400" : ""}`} />
                        <span className="text-xs font-bold text-white">{preset.label}</span>
                      </div>
                      <span className="text-[10px] text-neutral-500 block">{preset.subtitle}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Custom Syllabus / Notes Import */}
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/70 overflow-hidden transition-all">
              <button
                type="button"
                onClick={() => setShowCustomSyllabus(!showCustomSyllabus)}
                className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-neutral-900/60 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-lg bg-cyan-950 border border-cyan-800/80 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-neutral-200">
                      Have your own syllabus, curriculum, or notes?
                    </span>
                    <span className="ml-2 text-[10px] font-mono text-cyan-400 bg-cyan-950/80 px-2 py-0.5 rounded-full border border-cyan-800">
                      Optional
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-neutral-400 font-mono">
                  <span>{showCustomSyllabus ? "Hide" : "Paste Outline"}</span>
                  {showCustomSyllabus ? (
                    <ChevronUp className="w-3.5 h-3.5 text-neutral-400" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400" />
                  )}
                </div>
              </button>

              {showCustomSyllabus && (
                <div className="px-4 pb-4 pt-1 space-y-2 border-t border-neutral-800/80">
                  <p className="text-[11px] text-neutral-400">
                    Paste your course outline, video playlist, book chapters, or rough notes. Jarvis will parse and structure them into weekly milestones and daily action tasks.
                  </p>
                  <textarea
                    rows={4}
                    placeholder="Paste your curriculum, syllabus, or bullet points here...&#10;Example:&#10;• Week 1: System Design Fundamentals & CAP Theorem&#10;• Week 2: Database Sharding & Indexing in PostgreSQL&#10;• Week 3: Message Queues with Apache Kafka"
                    value={formData.customRoadmapText}
                    onChange={(e) =>
                      setFormData({ ...formData, customRoadmapText: e.target.value })
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-900/90 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-cyan-500 font-mono resize-y placeholder:text-neutral-600 leading-relaxed"
                    maxLength={10000}
                  />
                  <div className="flex items-center justify-between text-[10px] text-neutral-500">
                    <span>Supports raw bullet points, markdown, or plain text</span>
                    <span className="font-mono">
                      {formData.customRoadmapText.length} / 10000 chars
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Emotional "Why" Anchor */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-neutral-200 flex items-center justify-between">
                <span>Why Statement (Emotional Anchor)</span>
                <span className="text-[10px] text-neutral-500">Core intrinsic fuel</span>
              </label>
              <textarea
                required
                rows={2}
                placeholder="Why is this meaningful to you personally? What changes in your life?"
                value={formData.whyStatement}
                onChange={(e) => setFormData({ ...formData, whyStatement: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-sm focus:outline-none focus:border-cyan-500 font-medium resize-none placeholder:text-neutral-600"
              />
            </div>

            {/* Secondary Anchors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400">Why Now?</label>
                <input
                  type="text"
                  placeholder="Why must this happen now instead of later?"
                  value={formData.whyNowStatement}
                  onChange={(e) => setFormData({ ...formData, whyNowStatement: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-medium text-neutral-400">Cost of Inaction</label>
                <input
                  type="text"
                  placeholder="What happens if you postpone this another year?"
                  value={formData.inactionCostStatement}
                  onChange={(e) =>
                    setFormData({ ...formData, inactionCostStatement: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={synthesizing || !formData.title.trim()}
                className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {synthesizing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Synthesizing Visual Roadmap (~10s)...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate Visual Roadmap ➔</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: INTERACTIVE VISUAL ROADMAP CANVAS */}
        {step === 2 && roadmap && (
          <div className="p-6 space-y-6">
            {/* Arrival ETA Bar */}
            <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/60 to-blue-950/40 border border-cyan-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider font-semibold">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Projected Completion Arrival</span>
                </div>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {formatTargetDate(roadmap.targetDate)}
                </h3>
              </div>

              <div className="flex items-center gap-3 text-xs font-mono text-neutral-300">
                <span className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800">
                  {roadmap.durationWeeks} Weeks
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-neutral-900 border border-neutral-800">
                  {roadmap.durationWeeks * roadmap.weeklyHours} Total Hours
                </span>
              </div>
            </div>

            {/* Visual Milestone Timeline Canvas */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400 font-mono flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Personalize Milestone Phases ({roadmap.milestones.length})</span>
                </h4>
                <span className="text-[11px] text-neutral-500">
                  Click titles to edit • Add or remove tasks below
                </span>
              </div>

              <div className="space-y-4 max-h-[46vh] overflow-y-auto pr-1">
                {roadmap.milestones.map((milestone, mIdx) => (
                  <div
                    key={mIdx}
                    className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-3 relative group"
                  >
                    {/* Milestone header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="w-6 h-6 rounded-lg bg-cyan-950 border border-cyan-800 text-cyan-400 font-mono text-xs flex items-center justify-center shrink-0 font-bold">
                          {mIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={milestone.title}
                          onChange={(e) => updateMilestoneTitle(mIdx, e.target.value)}
                          className="w-full bg-transparent text-sm font-semibold text-neutral-200 border-b border-transparent hover:border-neutral-700 focus:border-cyan-500 focus:outline-none px-1 py-0.5"
                        />
                      </div>
                      <span className="text-[11px] font-mono text-neutral-500 shrink-0">
                        Target: Week {milestone.estimatedWeeksFromStart}
                      </span>
                    </div>

                    {/* Weekly Targets & Tasks */}
                    {milestone.weeklyTargets.map((wt, wtIdx) => (
                      <div key={wtIdx} className="space-y-2 pt-1 border-t border-neutral-800/60">
                        <div className="flex items-center justify-between text-xs text-neutral-400 font-mono">
                          <span>{wt.title}</span>
                          <span className="text-cyan-400">{wt.targetHours}h budget</span>
                        </div>

                        {/* Task List */}
                        <div className="space-y-1.5">
                          {wt.tasks.map((task, taskIdx) => (
                            <div
                              key={taskIdx}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-neutral-900 border border-neutral-800/80 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded font-mono uppercase shrink-0 ${
                                    task.priority === "P0_CRITICAL"
                                      ? "bg-rose-950/80 text-rose-400 border border-rose-800/60"
                                      : "bg-neutral-800 text-neutral-400"
                                  }`}
                                >
                                  {task.priority === "P0_CRITICAL" ? "P0" : "P1"}
                                </span>
                                <span className="text-neutral-200 font-medium truncate">
                                  {task.title}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] font-mono text-neutral-500">
                                  {task.estimatedMinutes}m
                                </span>
                                <button
                                  type="button"
                                  onClick={() => deleteTask(mIdx, wtIdx, taskIdx)}
                                  className="text-neutral-500 hover:text-rose-400 p-1 transition-colors"
                                  title="Delete task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}

                          <button
                            type="button"
                            onClick={() => addTask(mIdx, wtIdx)}
                            className="w-full py-1.5 rounded-lg border border-dashed border-neutral-800 hover:border-cyan-500/50 text-[11px] text-neutral-400 hover:text-cyan-300 flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add Mission Task</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Confirmation Bar */}
            <div className="pt-4 border-t border-neutral-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={confirming}
                className="px-4 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors flex items-center gap-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Adjust Horizon</span>
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirming}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold shadow-lg shadow-cyan-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {confirming ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Committing & Scheduling Tasks...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Confirm & Sync to Daily Life ⚡</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

