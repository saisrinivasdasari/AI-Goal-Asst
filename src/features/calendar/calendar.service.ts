import { prisma } from "@/lib/db/prisma";
import { TaskStatus, PriorityLevel, EnergyLevel } from "@prisma/client";
import { NotFoundError } from "@/lib/errors";

export interface CalendarTaskDTO {
  id: string; // TaskInstance ID
  taskId: string;
  title: string;
  description?: string | null;
  scheduledDate: string; // YYYY-MM-DD
  status: TaskStatus;
  priority: PriorityLevel;
  estimatedMinutes: number;
  requiredEnergy: EnergyLevel;
  goalId: string;
  goalTitle: string;
  goalCategory: string;
  milestoneTitle: string;
  milestoneOrderIndex: number;
  weeklyTargetTitle: string;
}

export class CalendarService {
  /**
   * Retrieves all tasks scheduled for the user, optionally filtered by month (YYYY-MM) and goalId.
   * Auto-schedules any un-instantiated roadmap tasks so the calendar is always 100% complete.
   */
  static async getCalendarTasks(
    userId: string,
    options?: { month?: string; goalId?: string }
  ): Promise<CalendarTaskDTO[]> {
    // 1. Backfill any tasks that do not have a TaskInstance yet
    await this.backfillUnscheduledTasks(userId, options?.goalId);

    // 2. Build where filter for TaskInstance
    const whereClause: any = {
      task: {
        weeklyTarget: {
          milestone: {
            goal: {
              userId,
              ...(options?.goalId ? { id: options.goalId } : {}),
            },
          },
        },
      },
    };

    if (options?.month) {
      const [yearStr, monthStr] = options.month.split("-");
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10); // 1-12

      // Expand window to include surrounding buffer for month grid (e.g. 7 days before and after)
      const startDate = new Date(Date.UTC(year, month - 1, -7));
      const endDate = new Date(Date.UTC(year, month, 14));

      whereClause.scheduledDate = {
        gte: startDate,
        lte: endDate,
      };
    }

    const instances = await prisma.taskInstance.findMany({
      where: whereClause,
      include: {
        task: {
          include: {
            weeklyTarget: {
              include: {
                milestone: {
                  include: {
                    goal: {
                      include: {
                        lifeArea: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [
        { scheduledDate: "asc" },
        { task: { priority: "asc" } },
      ],
    });

    return instances.map((inst) => {
      const task = inst.task;
      const target = task.weeklyTarget;
      const milestone = target.milestone;
      const goal = milestone.goal;

      const dateStr = inst.scheduledDate.toISOString().split("T")[0];

      return {
        id: inst.id,
        taskId: task.id,
        title: task.title,
        description: task.description,
        scheduledDate: dateStr,
        status: inst.status,
        priority: task.priority,
        estimatedMinutes: task.estimatedMinutes,
        requiredEnergy: task.requiredEnergy,
        goalId: goal.id,
        goalTitle: goal.title,
        goalCategory: goal.lifeArea?.name || "Career",
        milestoneTitle: milestone.title,
        milestoneOrderIndex: milestone.orderIndex,
        weeklyTargetTitle: target.title,
      };
    });
  }

  /**
   * Backfills task instances for any roadmap tasks that don't have one yet.
   */
  private static async backfillUnscheduledTasks(userId: string, goalId?: string) {
    const unscheduledTasks = await prisma.task.findMany({
      where: {
        weeklyTarget: {
          milestone: {
            goal: {
              userId,
              ...(goalId ? { id: goalId } : {}),
            },
          },
        },
        instances: {
          none: {},
        },
      },
      include: {
        weeklyTarget: {
          include: {
            milestone: true,
          },
        },
      },
    });

    if (unscheduledTasks.length === 0) return;

    const now = new Date();

    for (let i = 0; i < unscheduledTasks.length; i++) {
      const t = unscheduledTasks[i];
      const m = t.weeklyTarget.milestone;
      const order = Math.max(1, m.orderIndex);
      // Stagger dates: week offset + task offset
      const dayOffset = (order - 1) * 7 + (i % 5);
      const scheduledDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset));

      await prisma.taskInstance.create({
        data: {
          taskId: t.id,
          scheduledDate,
          status: TaskStatus.PENDING,
        },
      });
    }
  }

  /**
   * Updates task instance status or scheduled date
   */
  static async updateTaskInstance(
    userId: string,
    instanceId: string,
    data: { status?: TaskStatus; scheduledDate?: string }
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
      throw new NotFoundError("Task instance not found or unauthorized");
    }

    const updateData: any = {};
    if (data.status) {
      updateData.status = data.status;
      if (data.status === TaskStatus.COMPLETED) {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }

    if (data.scheduledDate) {
      updateData.scheduledDate = new Date(data.scheduledDate);
    }

    return prisma.taskInstance.update({
      where: { id: instanceId },
      data: updateData,
    });
  }
}

