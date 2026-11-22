"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  RefreshCw,
  X,
  CheckCircle2,
  Flame,
  Zap,
  Circle,
  Clock,
  Filter,
  ArrowRight,
  Layers,
} from "lucide-react";
import { CalendarTaskDTO } from "@/features/calendar/calendar.service";
import { TaskDetailModal } from "./task-detail-modal";

interface GoogleCalendarViewProps {
  goalId?: string; // If provided, filters to this goal only
  goalTitle?: string;
  isModal?: boolean;
  onClose?: () => void;
}

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export function GoogleCalendarView({
  goalId,
  goalTitle,
  isModal = false,
  onClose,
}: GoogleCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [tasks, setTasks] = useState<CalendarTaskDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<CalendarTaskDTO | null>(null);
  const [selectedGoalFilter, setSelectedGoalFilter] = useState<string>(goalId || "ALL");
  const [selectedDayTasks, setSelectedDayTasks] = useState<{ date: string; tasks: CalendarTaskDTO[] } | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-11
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("month", monthKey);
      if (goalId) {
        params.set("goalId", goalId);
      }

      const res = await fetch(`/api/v1/calendar?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.tasks) {
        setTasks(json.tasks);
      }
    } catch (err) {
      console.error("Failed to load calendar tasks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [monthKey, goalId]);

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleToggleTaskInDay = async (task: CalendarTaskDTO, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const newStatus = task.status === "COMPLETED" ? "PENDING" : "COMPLETED";
      const res = await fetch(`/api/v1/calendar/task/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedDayTasks((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus as any } : t)),
          };
        });
        fetchTasks();
      }
    } catch (err) {
      console.error("Failed to toggle task in day view:", err);
    }
  };

  // Distinct goals for filtering (if viewing all goals)
  const availableGoals = useMemo(() => {
    const map = new Map<string, string>();
    tasks.forEach((t) => {
      if (!map.has(t.goalId)) {
        map.set(t.goalId, t.goalTitle);
      }
    });
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [tasks]);

  // Filter tasks if specific goal selected in dropdown
  const filteredTasks = useMemo(() => {
    if (selectedGoalFilter === "ALL") return tasks;
    return tasks.filter((t) => t.goalId === selectedGoalFilter);
  }, [tasks, selectedGoalFilter]);

  // Tasks grouped by date key YYYY-MM-DD
  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTaskDTO[]>();
    filteredTasks.forEach((t) => {
      const list = map.get(t.scheduledDate) || [];
      list.push(t);
      map.set(t.scheduledDate, list);
    });
    return map;
  }, [filteredTasks]);

  // Build the 35 or 42 calendar grid cells
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const daysInMonth = lastDayOfMonth.getDate();

    // Day of week for 1st of month (0 = Sun, 1 = Mon ... 6 = Sat)
    // We want Monday as index 0
    let startDayIndex = firstDayOfMonth.getDay() - 1;
    if (startDayIndex === -1) startDayIndex = 6; // Sunday becomes 6

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const cells: Array<{
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      tasks: CalendarTaskDTO[];
    }> = [];

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    // 1. Previous month trailing days
    for (let i = startDayIndex - 1; i >= 0; i--) {
      const dayNum = prevMonthLastDay - i;
      const prevDate = new Date(year, month - 1, dayNum);
      const dateKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      cells.push({
        dateKey,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dateKey === todayKey,
        tasks: tasksByDate.get(dateKey) || [],
      });
    }

    // 2. Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({
        dateKey,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateKey === todayKey,
        tasks: tasksByDate.get(dateKey) || [],
      });
    }

    // 3. Next month leading days (to fill 35 or 42 grid cells)
    const totalCells = cells.length > 35 ? 42 : 35;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateKey = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({
        dateKey,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateKey === todayKey,
        tasks: tasksByDate.get(dateKey) || [],
      });
    }

    return cells;
  }, [year, month, tasksByDate]);

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "P0_CRITICAL":
        return "bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30";
      case "P1_IMPORTANT":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30";
      default:
        return "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30";
    }
  };

  const content = (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 rounded-2xl border border-neutral-800 shadow-2xl overflow-hidden">
      {/* Top Google Calendar Control Bar */}
      <div className="p-4 sm:p-5 border-b border-neutral-800 flex flex-wrap items-center justify-between gap-4 bg-neutral-900/60 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
            <CalendarIcon className="w-4 h-4" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {MONTH_NAMES[month]} {year}
              </h2>
              {loading && <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin" />}
            </div>
            <p className="text-xs text-neutral-400 font-mono">
              {goalTitle ? `${goalTitle} Schedule` : "Roadmap Execution Schedule"}
            </p>
          </div>
        </div>

        {/* Navigation & Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Today Button */}
          <button
            onClick={handleToday}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700 transition-colors"
          >
            Today
          </button>

          {/* Month Steppers */}
          <div className="flex items-center rounded-xl bg-neutral-900 border border-neutral-800 p-0.5">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Goal Filter (if on overview) */}
          {!goalId && availableGoals.length > 1 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-xs">
              <Filter className="w-3.5 h-3.5 text-neutral-500" />
              <select
                value={selectedGoalFilter}
                onChange={(e) => setSelectedGoalFilter(e.target.value)}
                className="bg-transparent text-xs text-neutral-300 focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Active Goals</option>
                {availableGoals.map((g) => (
                  <option key={g.id} value={g.id} className="bg-neutral-950 text-white">
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Close Modal Button */}
          {isModal && onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-neutral-800 text-neutral-500 hover:text-white transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Priority Legend Bar */}
      <div className="px-5 py-2.5 bg-neutral-950 border-b border-neutral-800/80 flex items-center justify-between text-[11px] font-mono text-neutral-400 shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span className="text-neutral-300">P0 Critical</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-neutral-300">P1 Important</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-500" />
            <span className="text-neutral-300">P2 Optional</span>
          </span>
        </div>

        <span className="hidden sm:inline text-neutral-500">
          💡 Click any date to view all tasks • Click a task for details
        </span>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 border-b border-neutral-800 bg-neutral-900/40 text-center text-xs font-mono font-medium text-neutral-400 py-2.5 shrink-0">
        {DAYS_OF_WEEK.map((day) => (
          <div key={day} className="tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Month Days Grid (Google Calendar Style) */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr divide-x divide-y divide-neutral-800/80 bg-neutral-950 overflow-y-auto min-h-[500px]">
        {calendarCells.map((cell, idx) => {
          const maxVisibleTasks = 2;
          const visibleTasks = cell.tasks.slice(0, maxVisibleTasks);
          const hiddenCount = cell.tasks.length - maxVisibleTasks;

          return (
            <div
              key={cell.dateKey + idx}
              onClick={() => setSelectedDayTasks({ date: cell.dateKey, tasks: cell.tasks })}
              className={`p-1.5 sm:p-2 min-h-[105px] sm:min-h-[120px] flex flex-col justify-start transition-colors relative cursor-pointer overflow-hidden group ${
                !cell.isCurrentMonth
                  ? "bg-neutral-950/40 opacity-40 hover:opacity-75"
                  : cell.isToday
                  ? "bg-cyan-950/25 ring-1 ring-inset ring-cyan-500/30 hover:bg-cyan-950/40"
                  : "hover:bg-neutral-900/50"
              }`}
            >
              {/* Day Number Header */}
              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={`text-xs font-mono font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full transition-all ${
                    cell.isToday
                      ? "bg-cyan-500 text-black font-bold shadow-md shadow-cyan-500/40"
                      : cell.isCurrentMonth
                      ? "text-neutral-300 group-hover:text-cyan-400"
                      : "text-neutral-600"
                  }`}
                >
                  {cell.dayNumber}
                </span>

                {cell.tasks.length > 0 && (
                  <span className="text-[10px] font-mono text-neutral-400 bg-neutral-900/80 px-1.5 py-0.5 rounded-full border border-neutral-800 group-hover:border-cyan-500/40 transition-colors">
                    {cell.tasks.length} {cell.tasks.length === 1 ? "task" : "tasks"}
                  </span>
                )}
              </div>

              {/* Task Badges Stack (Google Calendar Style) */}
              <div className="space-y-1 flex-1 overflow-hidden">
                {visibleTasks.map((task) => {
                  const isDone = task.status === "COMPLETED";
                  const priorityClass = getPriorityStyle(task.priority);

                  return (
                    <button
                      key={task.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedTask(task);
                      }}
                      className={`w-full text-left px-1.5 py-1 rounded-md border text-[11px] font-medium leading-tight flex items-center justify-between gap-1 transition-all group ${priorityClass} ${
                        isDone ? "opacity-60 line-through border-neutral-700 bg-neutral-900/50" : ""
                      }`}
                      title={task.title}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        {isDone ? (
                          <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : (
                          <span
                            className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              task.priority === "P0_CRITICAL"
                                ? "bg-rose-400"
                                : task.priority === "P1_IMPORTANT"
                                ? "bg-amber-400"
                                : "bg-cyan-400"
                            }`}
                          />
                        )}
                        <span className="truncate">{task.title}</span>
                      </div>

                      <span className="text-[9px] font-mono opacity-70 shrink-0 hidden sm:inline">
                        {task.estimatedMinutes}m
                      </span>
                    </button>
                  );
                })}

                {/* +N More Tasks Pill */}
                {hiddenCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDayTasks({ date: cell.dateKey, tasks: cell.tasks });
                    }}
                    className="w-full text-left px-1.5 py-0.5 text-[10px] font-mono font-semibold text-cyan-400 hover:text-cyan-300 transition-colors"
                  >
                    +{hiddenCount} more
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Details Modal (Opens on Task Click) */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onTaskUpdated={fetchTasks}
      />

      {/* Day Overview Modal (Opens on date / day cell click or +N more) */}
      {selectedDayTasks && (() => {
        const dateObj = new Date(selectedDayTasks.date + "T00:00:00");
        const formattedDateTitle = dateObj.toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        });
        const totalMinutes = selectedDayTasks.tasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
        const completedCount = selectedDayTasks.tasks.filter((t) => t.status === "COMPLETED").length;
        const totalCount = selectedDayTasks.tasks.length;
        const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="relative w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-neutral-950 border-t sm:border border-neutral-800 shadow-2xl p-5 sm:p-6 space-y-4 sm:space-y-5 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
              {/* Grab Handle for mobile */}
              <div className="w-10 h-1 rounded-full bg-neutral-700/80 mx-auto -mt-1 sm:hidden shrink-0" />
              {/* Header */}
              <div className="flex items-start justify-between pb-3 border-b border-neutral-800">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {formattedDateTitle}
                  </h3>
                  <p className="text-xs text-neutral-400 font-mono pt-0.5">
                    {totalCount} {totalCount === 1 ? "task" : "tasks"} • {totalMinutes}m planned effort
                    {totalCount > 0 && ` • ${completedCount} completed (${pct}%)`}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedDayTasks(null)}
                  className="text-neutral-500 hover:text-neutral-300 p-1.5 rounded-lg transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Task Cards List */}
              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                {selectedDayTasks.tasks.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-neutral-900/40 border border-dashed border-neutral-800 space-y-2">
                    <CalendarIcon className="w-8 h-8 text-neutral-600 mx-auto" />
                    <p className="text-xs font-semibold text-neutral-300">No Tasks Scheduled</p>
                    <p className="text-[11px] text-neutral-500">
                      Enjoy open capacity or flexible recovery time on this day.
                    </p>
                  </div>
                ) : (
                  selectedDayTasks.tasks.map((t) => {
                    const isDone = t.status === "COMPLETED";
                    const isP0 = t.priority === "P0_CRITICAL";
                    const isP1 = t.priority === "P1_IMPORTANT";

                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedDayTasks(null);
                          setSelectedTask(t);
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer group flex items-start justify-between gap-3 ${
                          isDone
                            ? "bg-neutral-900/40 border-neutral-800/60 opacity-70"
                            : "bg-neutral-900/80 border-neutral-800 hover:border-cyan-500/60 hover:bg-neutral-900"
                        }`}
                      >
                        {/* Checkbox toggle */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleTaskInDay(t, e)}
                          className="pt-0.5 text-neutral-500 hover:text-emerald-400 transition-colors shrink-0"
                          title={isDone ? "Mark Pending" : "Mark Completed"}
                        >
                          {isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Circle className="w-4 h-4 text-neutral-600 group-hover:text-cyan-400" />
                          )}
                        </button>

                        {/* Title and Breadcrumbs */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded font-mono ${
                                isP0
                                  ? "bg-rose-950/80 text-rose-300 border border-rose-800/60"
                                  : isP1
                                  ? "bg-amber-950/80 text-amber-300 border border-amber-800/60"
                                  : "bg-cyan-950/80 text-cyan-300 border border-cyan-800/60"
                              }`}
                            >
                              {isP0 ? "P0 Critical" : isP1 ? "P1" : "P2"}
                            </span>
                            <span className="text-[10px] font-mono text-cyan-400/80 uppercase">
                              {t.goalCategory}
                            </span>
                          </div>

                          <h4
                            className={`text-xs font-semibold text-neutral-200 group-hover:text-cyan-300 transition-colors ${
                              isDone ? "line-through text-neutral-500" : ""
                            }`}
                          >
                            {t.title}
                          </h4>

                          <p className="text-[11px] text-neutral-400 flex items-center gap-1.5 truncate">
                            <span>{t.goalTitle}</span>
                            <span>•</span>
                            <span className="text-neutral-500">{t.milestoneTitle}</span>
                          </p>
                        </div>

                        {/* Meta time badge & open icon */}
                        <div className="flex flex-col items-end gap-1.5 shrink-0 text-right">
                          <span className="text-[10px] font-mono text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                            {t.estimatedMinutes}m
                          </span>
                          <span className="text-[10px] font-mono text-neutral-500 group-hover:text-cyan-400 transition-colors flex items-center gap-0.5">
                            <span>Details</span>
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150">
        <div className="w-full max-w-6xl h-[92vh] flex flex-col">
          {content}
        </div>
      </div>
    );
  }

  return content;
}

