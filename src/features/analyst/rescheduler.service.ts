import { prisma } from "@/lib/db/prisma";
import { CapacityService } from "@/features/capacity/capacity.service";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { PriorityLevel, TaskStatus, EnergyLevel } from "@prisma/client";

export interface RescheduleRequest {
  missedTaskInstanceId: string;
  preferredDate?: string;
}

export class AdaptiveReschedulerService {
  /**
   * Reschedules missed tasks according to P0/P1/P2 priority rules and capacity caps.
   * Eliminates backlog snowball debt and shame.
   */
  static async rescheduleMissedTask(userId: string, input: RescheduleRequest) {
    const { missedTaskInstanceId, preferredDate } = input;

    const instance = await prisma.taskInstance.findFirst({
      where: {
        id: missedTaskInstanceId,
        task: {
          weeklyTarget: {
            milestone: {
              goal: { userId },
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
    });

    if (!instance) {
      throw new NotFoundError("Task instance not found");
    }

    const task = instance.task;
    const goal = task.weeklyTarget.milestone.goal;

    // Mark current instance as MISSED or RESCHEDULED
    await prisma.taskInstance.update({
      where: { id: instance.id },
      data: {
        status: TaskStatus.MISSED,
      },
    });

    // 1. Determine Next Scheduled Date
    let newDate = new Date();
    if (preferredDate) {
      newDate = new Date(preferredDate);
    } else {
      newDate.setDate(newDate.getDate() + 1); // default to tomorrow
    }
    newDate.setHours(0, 0, 0, 0);

    // 2. Capacity Check for the Week
    const capacity = await CapacityService.getCapacity(userId);
    const netWeeklyHours = capacity.schedule.netAvailableGoalHours;

    // Calculate currently planned hours for this week
    const weekStart = new Date(newDate);
    const day = weekStart.getDay() || 7;
    weekStart.setDate(weekStart.getDate() - day + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weeklyInstances = await prisma.taskInstance.findMany({
      where: {
        scheduledDate: { gte: weekStart, lt: weekEnd },
        status: { in: [TaskStatus.PENDING, TaskStatus.IN_PROGRESS] },
        task: {
          weeklyTarget: {
            milestone: {
              goal: { userId },
            },
          },
        },
      },
      include: { task: true },
    });

    let weeklyPlannedMinutes = weeklyInstances.reduce((sum, i) => sum + i.task.estimatedMinutes, 0);
    const addedMinutes = task.estimatedMinutes;
    const willExceedCapacity = (weeklyPlannedMinutes + addedMinutes) / 60 > netWeeklyHours;

    let prunedTasks: string[] = [];
    let explanation = "";

    // 3. Priority Execution Logic
    if (task.priority === PriorityLevel.P0_CRITICAL) {
      // P0 MUST be carried forward
      if (willExceedCapacity) {
        // Prune lowest priority P2 items to make room
        const optionalInstances = weeklyInstances.filter((i) => i.task.priority === PriorityLevel.P2_OPTIONAL);

        for (const opt of optionalInstances) {
          if ((weeklyPlannedMinutes + addedMinutes) / 60 > netWeeklyHours) {
            await prisma.taskInstance.update({
              where: { id: opt.id },
              data: {
                status: TaskStatus.PRUNED,
                notes: `Automatically pruned to protect capacity for critical task: ${task.title}`,
              },
            });
            weeklyPlannedMinutes -= opt.task.estimatedMinutes;
            prunedTasks.push(opt.task.title);
          }
        }
      }

      // Create new scheduled instance
      const newInstance = await prisma.taskInstance.create({
        data: {
          taskId: task.id,
          scheduledDate: newDate,
          status: TaskStatus.PENDING,
          rescheduledCount: instance.rescheduledCount + 1,
          notes: `Rescheduled from ${instance.scheduledDate.toISOString().split("T")[0]}`,
        },
      });

      const dayName = newDate.toLocaleDateString("en-US", { weekday: "long" });
      explanation = prunedTasks.length > 0
        ? `I have moved your critical mission "${task.title}" to ${dayName}. To keep your load sustainable and prevent burnout, I've pruned ${prunedTasks.length} optional item(s) (${prunedTasks.join(", ")}). Keep your momentum!`
        : `I have moved your critical mission "${task.title}" to ${dayName}. Your capacity is clear and ready.`;

      return {
        action: "CARRIED_FORWARD_RESCHEDULED",
        newInstance,
        prunedTasks,
        explanation,
        whyAnchor: goal.whyReason,
      };
    } else if (task.priority === PriorityLevel.P1_IMPORTANT) {
      if (willExceedCapacity) {
        // Postpone to next week or prompt adjustment
        newDate.setDate(newDate.getDate() + 7);
      }

      const newInstance = await prisma.taskInstance.create({
        data: {
          taskId: task.id,
          scheduledDate: newDate,
          status: TaskStatus.PENDING,
          rescheduledCount: instance.rescheduledCount + 1,
        },
      });

      const dayName = newDate.toLocaleDateString("en-US", { weekday: "long" });
      explanation = `Adjusted "${task.title}" to ${dayName}. Consistency over perfection.`;

      return {
        action: "RESCHEDULED",
        newInstance,
        prunedTasks: [],
        explanation,
        whyAnchor: goal.whyReason,
      };
    } else {
      // P2_OPTIONAL: Drop without guilt
      await prisma.taskInstance.update({
        where: { id: instance.id },
        data: {
          status: TaskStatus.PRUNED,
          notes: "Dropped optional task to protect human capacity",
        },
      });

      explanation = `"${task.title}" was an optional item. I have pruned it so you can stay fully focused on your core vision for "${goal.title}". Zero guilt, maximum focus.`;

      return {
        action: "PRUNED_ZERO_GUILT",
        prunedTasks: [task.title],
        explanation,
        whyAnchor: goal.whyReason,
      };
    }
  }
}

