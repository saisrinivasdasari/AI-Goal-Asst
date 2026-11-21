import { prisma } from "@/lib/db/prisma";
import { CapacityService } from "@/features/capacity/capacity.service";
import { NotFoundError } from "@/lib/errors";
import { TaskStatus } from "@prisma/client";

export class MissionService {
  /**
   * Retrieves today's mission payload, grouping tasks by energy requirement
   * and linking each task directly to its emotional 'Why' anchor.
   */
  static async getTodaysMission(userId: string) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // Fetch tasks scheduled for today
    const instances = await prisma.taskInstance.findMany({
      where: {
        scheduledDate: {
          gte: today,
          lt: tomorrow,
        },
        task: {
          weeklyTarget: {
            milestone: {
              goal: {
                userId,
                status: "ACTIVE",
              },
            },
          },
        },
      },
      include: {
        task: {
          include: {
            weeklyTarget: {
              include: {
                milestone: {
                  include: {
                    goal: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ task: { priority: "asc" } }, { id: "asc" }],
    });

    const currentEnergyLevel = await CapacityService.getCurrentEnergySlot(userId);

    let totalMinutes = 0;
    let completedMinutes = 0;
    let completedCount = 0;

    const tasks = instances.map((inst) => {
      const t = inst.task;
      const g = t.weeklyTarget.milestone.goal;

      totalMinutes += t.estimatedMinutes;
      if (inst.status === TaskStatus.COMPLETED) {
        completedCount++;
        completedMinutes += inst.actualMinutes || t.estimatedMinutes;
      }

      return {
        id: inst.id,
        instanceId: inst.id,
        taskId: t.id,
        title: t.title,
        description: t.description,
        priority: t.priority,
        status: inst.status,
        requiredEnergy: t.requiredEnergy,
        estimatedMinutes: t.estimatedMinutes,
        actualMinutes: inst.actualMinutes,
        rescheduledCount: inst.rescheduledCount,
        // Emotional motivation anchors from Goal
        goalTitle: g.title,
        whyReason: g.whyReason,
        costOfInaction: g.costOfInaction,
        dreamVision: g.dreamVision,
        isEnergyMatched: t.requiredEnergy === currentEnergyLevel,
      };
    });

    const completionRate = tasks.length > 0 ? parseFloat(((completedCount / tasks.length) * 100).toFixed(1)) : 0;

    return {
      date: today.toISOString().split("T")[0],
      currentEnergyLevel,
      completionRate,
      metrics: {
        totalTasks: tasks.length,
        completedTasks: completedCount,
        totalPlannedMinutes: totalMinutes,
        completedMinutes,
      },
      tasks,
    };
  }

  /**
   * Updates task status (Complete, Missed, In Progress)
   */
  static async updateTaskStatus(
    userId: string,
    instanceId: string,
    status: TaskStatus,
    actualMinutes?: number,
    notes?: string
  ) {
    const instance = await prisma.taskInstance.findFirst({
      where: {
        id: instanceId,
        task: {
          weeklyTarget: {
            milestone: {
              goal: {
                userId,
              },
            },
          },
        },
      },
    });

    if (!instance) {
      throw new NotFoundError("Task instance not found");
    }

    const updated = await prisma.taskInstance.update({
      where: { id: instanceId },
      data: {
        status,
        ...(status === TaskStatus.COMPLETED ? { completedAt: new Date() } : {}),
        ...(actualMinutes ? { actualMinutes } : {}),
        ...(notes ? { notes } : {}),
      },
    });

    return updated;
  }

  /**
   * Fetches upcoming tasks scheduled for the next 7 days
   */
  static async getUpcomingTasks(userId: string) {
    const now = new Date();
    const tomorrow = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 1));
    const nextWeek = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 8));

    const instances = await prisma.taskInstance.findMany({
      where: {
        scheduledDate: {
          gte: tomorrow,
          lt: nextWeek,
        },
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        task: {
          weeklyTarget: {
            milestone: {
              goal: { userId, status: "ACTIVE" },
            },
          },
        },
      },
      include: {
        task: {
          include: {
            weeklyTarget: {
              include: {
                milestone: {
                  include: { goal: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ scheduledDate: "asc" }, { task: { priority: "asc" } }],
    });

    return instances.map((inst) => ({
      id: inst.id,
      instanceId: inst.id,
      title: inst.task.title,
      scheduledDate: inst.scheduledDate.toISOString().split("T")[0],
      priority: inst.task.priority,
      status: inst.status,
      requiredEnergy: inst.task.requiredEnergy,
      estimatedMinutes: inst.task.estimatedMinutes,
      goalTitle: inst.task.weeklyTarget.milestone.goal.title,
    }));
  }

  /**
   * Pulls forward the next future task into today's mission checklist (Velocity boost)
   */
  static async pullForwardNextTask(userId: string) {
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    // Find the earliest upcoming pending task scheduled after today
    const nextTask = await prisma.taskInstance.findFirst({
      where: {
        scheduledDate: { gte: tomorrow },
        status: TaskStatus.PENDING,
        task: {
          weeklyTarget: {
            milestone: {
              goal: { userId, status: "ACTIVE" },
            },
          },
        },
      },
      include: {
        task: {
          include: {
            weeklyTarget: {
              include: {
                milestone: {
                  include: { goal: true },
                },
              },
            },
          },
        },
      },
      orderBy: [{ scheduledDate: "asc" }, { task: { priority: "asc" } }],
    });

    if (!nextTask) {
      return {
        success: false,
        message: "No upcoming tasks in the queue. You are completely caught up!",
      };
    }

    const updated = await prisma.taskInstance.update({
      where: { id: nextTask.id },
      data: {
        scheduledDate: today,
        notes: `Pulled forward on high energy momentum from ${nextTask.scheduledDate.toISOString().split("T")[0]}`,
      },
    });

    return {
      success: true,
      message: `Pulled forward "${nextTask.task.title}" to today. Outstanding velocity!`,
      task: {
        id: updated.id,
        title: nextTask.task.title,
        priority: nextTask.task.priority,
        estimatedMinutes: nextTask.task.estimatedMinutes,
        goalTitle: nextTask.task.weeklyTarget.milestone.goal.title,
      },
    };
  }

  /**
   * Fluid Rest Mode: Shifts all pending tasks forward by N days with zero guilt
   */
  static async takeLeave(userId: string, days: number = 1) {
    const shiftDays = Math.max(1, Math.min(days, 30));
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

    // Find all future and today's pending tasks
    const pending = await prisma.taskInstance.findMany({
      where: {
        scheduledDate: { gte: today },
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        task: {
          weeklyTarget: {
            milestone: {
              goal: { userId, status: "ACTIVE" },
            },
          },
        },
      },
      select: { id: true, scheduledDate: true },
    });

    for (const item of pending) {
      const newDate = new Date(item.scheduledDate);
      newDate.setUTCDate(newDate.getUTCDate() + shiftDays);
      await prisma.taskInstance.update({
        where: { id: item.id },
        data: { scheduledDate: newDate },
      });
    }

    return {
      success: true,
      shiftedCount: pending.length,
      days: shiftDays,
      message: `Rest mode activated for ${shiftDays} day(s). ${pending.length} tasks smoothly shifted forward. Zero guilt—enjoy your break!`,
    };
  }
}

