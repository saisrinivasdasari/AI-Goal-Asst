import { describe, it, expect, vi } from "vitest";
import { CalendarService } from "@/features/calendar/calendar.service";
import { prisma } from "@/lib/db/prisma";
import { TaskStatus, PriorityLevel, EnergyLevel } from "@prisma/client";

describe("CalendarService Unit Tests", () => {
  it("should format calendar tasks properly with goal and milestone metadata", async () => {
    vi.spyOn(prisma.task, "findMany").mockResolvedValueOnce([]);
    vi.spyOn(prisma.taskInstance, "findMany").mockResolvedValueOnce([
      {
        id: "inst-1",
        taskId: "task-1",
        scheduledDate: new Date("2026-11-05T00:00:00.000Z"),
        status: TaskStatus.PENDING,
        actualMinutes: null,
        notes: null,
        rescheduledCount: 0,
        completedAt: null,
        task: {
          id: "task-1",
          weeklyTargetId: "wt-1",
          title: "Setup trading environment",
          description: "Initialize workspace",
          priority: PriorityLevel.P0_CRITICAL,
          estimatedMinutes: 45,
          requiredEnergy: EnergyLevel.HIGH_FOCUS,
          weeklyTarget: {
            id: "wt-1",
            milestoneId: "m-1",
            title: "Week 1: Foundations",
            weekNumber: 45,
            year: 2026,
            targetHours: 5,
            completedAt: null,
            milestone: {
              id: "m-1",
              goalId: "goal-1",
              title: "Phase 1: Environment",
              orderIndex: 1,
              targetDate: new Date("2026-11-15"),
              progressPct: 0,
              completedAt: null,
              goal: {
                id: "goal-1",
                userId: "user-1",
                lifeAreaId: "area-1",
                title: "Master Trading",
                dreamVision: "Master Trading",
                whyReason: "Financial independence",
                whyNow: "Urgent",
                costOfInaction: "Stagnation",
                successDefinition: "100% completion",
                targetDate: new Date("2026-12-31"),
                estimatedHoursTotal: 40,
                completedAt: null,
                status: "ACTIVE",
                createdAt: new Date(),
                updatedAt: new Date(),
                lifeArea: {
                  id: "area-1",
                  userId: "user-1",
                  name: "Career & Wealth",
                  icon: "compass",
                  color: "#06b6d4",
                  targetShare: 0.2,
                  createdAt: new Date(),
                },
              },
            },
          },
        },
      } as any,
    ]);

    const tasks = await CalendarService.getCalendarTasks("user-1", { month: "2026-11" });

    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe("inst-1");
    expect(tasks[0].title).toBe("Setup trading environment");
    expect(tasks[0].scheduledDate).toBe("2026-11-05");
    expect(tasks[0].priority).toBe("P0_CRITICAL");
    expect(tasks[0].goalTitle).toBe("Master Trading");
    expect(tasks[0].goalCategory).toBe("Career & Wealth");
    expect(tasks[0].milestoneTitle).toBe("Phase 1: Environment");
    expect(tasks[0].weeklyTargetTitle).toBe("Week 1: Foundations");
  });

  it("should update task instance status via updateTaskInstance", async () => {
    vi.spyOn(prisma.taskInstance, "findFirst").mockResolvedValueOnce({
      id: "inst-1",
    } as any);

    vi.spyOn(prisma.taskInstance, "update").mockResolvedValueOnce({
      id: "inst-1",
      status: TaskStatus.COMPLETED,
    } as any);

    const updated = await CalendarService.updateTaskInstance("user-1", "inst-1", {
      status: TaskStatus.COMPLETED,
    });

    expect(updated.status).toBe(TaskStatus.COMPLETED);
  });
});

