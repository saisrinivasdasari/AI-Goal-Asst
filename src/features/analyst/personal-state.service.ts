import { prisma } from "@/lib/db/prisma";
import { CapacityService } from "@/features/capacity/capacity.service";
import { TaskStatus, PriorityLevel, EnergyLevel } from "@prisma/client";

export interface PersonalStateSnapshot {
  user: {
    fullName: string;
    motivationalStyle: string;
  };
  activeGoals: Array<{
    id: string;
    title: string;
    progressPct: number;
    daysRemaining: number;
    whyReason: string;
  }>;
  todaysMission: {
    totalPlannedMinutes: number;
    completedCount: number;
    pendingCount: number;
    tasks: Array<{
      title: string;
      priority: PriorityLevel;
      status: TaskStatus;
      requiredEnergy: EnergyLevel;
    }>;
  };
  capacity: {
    netAvailableHours: number;
    currentEnergyLevel: EnergyLevel;
  };
  activeAntiGoals: string[];
}

export class PersonalStateService {
  /**
   * Aggregates a complete, token-efficient snapshot of the user's current life operating state
   * to provide total situational grounding in every AI interaction.
   */
  static async getSnapshot(userId: string): Promise<PersonalStateSnapshot> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        antiGoals: true,
      },
    });

    const capacity = await CapacityService.getCapacity(userId);
    const currentEnergyLevel = await CapacityService.getCurrentEnergySlot(userId);

    const goals = await prisma.goal.findMany({
      where: { userId, status: "ACTIVE" },
      include: {
        milestones: {
          include: {
            weeklyTargets: {
              include: {
                tasks: {
                  include: { instances: true },
                },
              },
            },
          },
        },
      },
    });

    const activeGoals = goals.map((g) => {
      let total = 0;
      let done = 0;
      g.milestones.forEach((m) => {
        m.weeklyTargets.forEach((wt) => {
          wt.tasks.forEach((t) => {
            total += t.instances.length;
            done += t.instances.filter((i) => i.status === TaskStatus.COMPLETED).length;
          });
        });
      });
      const progressPct = total > 0 ? parseFloat(((done / total) * 100).toFixed(1)) : 0;
      const daysRemaining = Math.max(0, Math.ceil((g.targetDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

      return {
        id: g.id,
        title: g.title,
        progressPct,
        daysRemaining,
        whyReason: g.whyReason,
      };
    });

    // Today's tasks
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayInstances = await prisma.taskInstance.findMany({
      where: {
        scheduledDate: { gte: today, lt: tomorrow },
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

    const tasks = todayInstances.map((i) => ({
      title: i.task.title,
      priority: i.task.priority,
      status: i.status,
      requiredEnergy: i.task.requiredEnergy,
    }));

    const totalMinutes = todayInstances.reduce((sum, i) => sum + i.task.estimatedMinutes, 0);
    const completedCount = todayInstances.filter((i) => i.status === TaskStatus.COMPLETED).length;

    return {
      user: {
        fullName: user?.profile?.fullName || "Traveler",
        motivationalStyle: user?.profile?.motivationalStyle || "supportive_friend",
      },
      activeGoals,
      todaysMission: {
        totalPlannedMinutes: totalMinutes,
        completedCount,
        pendingCount: todayInstances.length - completedCount,
        tasks,
      },
      capacity: {
        netAvailableHours: capacity.schedule.netAvailableGoalHours,
        currentEnergyLevel,
      },
      activeAntiGoals: (user?.antiGoals || []).map((a) => a.description),
    };
  }
}

