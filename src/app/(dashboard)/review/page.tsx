"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Send,
  Layers,
  Award,
  BookOpen,
} from "lucide-react";

interface WeeklyReview {
  id: string;
  weekStartDate: string;
  totalPlannedHours: number;
  totalActualHours: number;
  completedTasksCount: number;
  missedTasksCount: number;
  blockerObservations?: string;
  aiSuggestion?: string;
  userAdjustmentNotes?: string;
  createdAt: string;
}

interface MonthlyReview {
  id: string;
  monthStartDate: string;
  achievementsSummary?: string;
  learningSummary?: string;
  challengesSummary?: string;
  patternsSummary?: string;
  identityShiftNotes?: string;
  aiRecommendations?: string;
  userReflections?: string;
  createdAt: string;
}

export default function ReviewPage() {
  const [activeTab, setActiveTab] = useState<"weekly" | "monthly">("weekly");
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [monthlyReviews, setMonthlyReviews] = useState<MonthlyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form states
  const [weeklyNotes, setWeeklyNotes] = useState("");
  const [identityNotes, setIdentityNotes] = useState("");
  const [monthlyReflections, setMonthlyReflections] = useState("");

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const [wRes, mRes] = await Promise.all([
        fetch("/api/v1/reviews/weekly"),
        fetch("/api/v1/reviews/monthly"),
      ]);
      const wJson = await wRes.json();
      const mJson = await mRes.json();
      if (wJson.success) setWeeklyReviews(wJson.data);
      if (mJson.success) setMonthlyReviews(mJson.data);
    } catch (err) {
      console.error("Failed to load reviews:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleGenerateWeekly = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/reviews/weekly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userAdjustmentNotes: weeklyNotes }),
      });
      const json = await res.json();
      if (json.success) {
        setWeeklyNotes("");
        fetchReviews();
      }
    } catch (err) {
      console.error("Weekly review generation failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerateMonthly = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await fetch("/api/v1/reviews/monthly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityShiftNotes: identityNotes,
          userReflections: monthlyReflections,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setIdentityNotes("");
        setMonthlyReflections("");
        fetchReviews();
      }
    } catch (err) {
      console.error("Monthly review generation failed:", err);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        <p className="text-sm font-mono text-neutral-400">Loading Periodic Reviews...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-wider">
            <Calendar className="w-4 h-4" />
            <span>Structured Reflection Loops</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Periodic Reviews</h1>
          <p className="text-xs text-neutral-400">
            Calibrate your trajectory through weekly tactical adjustments and 30-day identity shifts.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-neutral-900 border border-neutral-800 self-start md:self-auto">
          <button
            onClick={() => setActiveTab("weekly")}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "weekly"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Weekly Tactical Review
          </button>
          <button
            onClick={() => setActiveTab("monthly")}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === "monthly"
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            Monthly Strategic Review
          </button>
        </div>
      </div>

      {activeTab === "weekly" ? (
        <div className="space-y-8">
          {/* Create Weekly Review Box */}
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 font-mono">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Synthesize Past 7 Days</span>
              </div>
              <h2 className="text-base font-bold text-white">Generate Weekly Tactical Review</h2>
              <p className="text-xs text-neutral-400">
                Jarvis aggregates your task completion rate, planned vs actual hours, and journal friction to calibrate next week.
              </p>
            </div>

            <form onSubmit={handleGenerateWeekly} className="space-y-4">
              <input
                type="text"
                value={weeklyNotes}
                onChange={(e) => setWeeklyNotes(e.target.value)}
                placeholder="Optional adjustment notes (e.g. 'Took Tuesday off for travel', 'Feel ready to push harder on backend')..."
                className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-cyan-500 font-medium"
              />

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Conduct Weekly Review</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Past Weekly Reviews */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">
              Weekly Archive ({weeklyReviews.length})
            </h3>

            {weeklyReviews.length > 0 ? (
              <div className="space-y-4">
                {weeklyReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-cyan-400 font-semibold">
                        Week of {new Date(rev.weekStartDate).toLocaleDateString()}
                      </span>
                      <div className="flex items-center gap-4 text-xs font-mono text-neutral-400">
                        <span>Tasks: {rev.completedTasksCount} done / {rev.missedTasksCount} missed</span>
                        <span>•</span>
                        <span>Hours: {rev.totalActualHours}h actual / {rev.totalPlannedHours}h planned</span>
                      </div>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-neutral-800/60">
                      {rev.blockerObservations && (
                        <div className="text-xs text-neutral-300">
                          <span className="font-semibold text-neutral-200">Friction Observations: </span>
                          {rev.blockerObservations}
                        </div>
                      )}
                      {rev.aiSuggestion && (
                        <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/60 text-xs text-cyan-200 leading-relaxed">
                          <span className="font-semibold text-cyan-300">Jarvis Strategy: </span>
                          {rev.aiSuggestion}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl bg-neutral-900/20 border border-dashed border-neutral-800 text-xs text-neutral-500">
                No weekly reviews recorded yet. Click above to generate your first review.
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Monthly Strategic Review Tab */
        <div className="space-y-8">
          <div className="p-6 rounded-2xl bg-neutral-900/60 border border-neutral-800 space-y-4 shadow-xl">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold text-cyan-400 font-mono">
                <Award className="w-3.5 h-3.5" />
                <span>30-Day Strategic Synthesis & Identity Shift</span>
              </div>
              <h2 className="text-base font-bold text-white">Generate Monthly Strategic Review</h2>
              <p className="text-xs text-neutral-400">
                Reflect on identity shifts, milestone achievements, and life area balance over the last 30 days.
              </p>
            </div>

            <form onSubmit={handleGenerateMonthly} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  Identity Shift: What changed about who you are this month?
                </label>
                <textarea
                  rows={2}
                  value={identityNotes}
                  onChange={(e) => setIdentityNotes(e.target.value)}
                  placeholder="e.g. 'I transitioned from dreaming about backend systems to building production database architectures effortlessly.'"
                  className="w-full p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-cyan-500 font-medium resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-neutral-300">
                  Personal Reflections & Gratitude
                </label>
                <input
                  type="text"
                  value={monthlyReflections}
                  onChange={(e) => setMonthlyReflections(e.target.value)}
                  placeholder="Key highlights, personal wins, or lessons learned..."
                  className="w-full px-4 py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-100 text-xs focus:outline-none focus:border-cyan-500 font-medium"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-lg shadow-cyan-600/20 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Synthesizing Strategic Review...</span>
                    </>
                  ) : (
                    <>
                      <Award className="w-3.5 h-3.5" />
                      <span>Conduct Monthly Review</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Past Monthly Reviews */}
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-white">
              Monthly Strategic Archive ({monthlyReviews.length})
            </h3>

            {monthlyReviews.length > 0 ? (
              <div className="space-y-4">
                {monthlyReviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-6 rounded-2xl bg-neutral-900/40 border border-neutral-800 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono text-cyan-400 font-semibold uppercase">
                        Month of {new Date(rev.monthStartDate).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                      </span>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-neutral-800/60 text-xs">
                      {rev.achievementsSummary && (
                        <div>
                          <span className="font-semibold text-emerald-400">Achievements: </span>
                          <span className="text-neutral-300">{rev.achievementsSummary}</span>
                        </div>
                      )}
                      {rev.learningSummary && (
                        <div>
                          <span className="font-semibold text-cyan-400">Learning Synthesis: </span>
                          <span className="text-neutral-300">{rev.learningSummary}</span>
                        </div>
                      )}
                      {rev.identityShiftNotes && (
                        <div className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 text-neutral-200 italic">
                          <span className="font-semibold text-amber-300 not-italic">Identity Shift: </span>
                          "{rev.identityShiftNotes}"
                        </div>
                      )}
                      {rev.aiRecommendations && (
                        <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/60 text-cyan-200">
                          <span className="font-semibold text-cyan-300">Strategic Guidance: </span>
                          {rev.aiRecommendations}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl bg-neutral-900/20 border border-dashed border-neutral-800 text-xs text-neutral-500">
                No monthly strategic reviews recorded yet. Click above to conduct your first 30-day review.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

