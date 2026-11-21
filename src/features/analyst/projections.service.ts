import { prisma } from "@/lib/db/prisma";

export interface GoalProjectionTrajectory {
  trajectory: "ON_TRACK_ACCELERATED" | "BASELINE_REALISTIC" | "DRIFT_STATUS_QUO";
  title: string;
  projectedCompletionDate: string;
  daysDelta: number; // e.g. -14 days (early), +21 days (late)
  confidenceScore: number; // 0-100%
  description: string;
  milestoneOutcomes: {
    milestoneTitle: string;
    projectedDate: string;
    status: "EARLY" | "ON_TIME" | "DELAYED" | "AT_RISK";
  }[];
  identityNarrative: string;
}

export interface FutureYouReport {
  goalId: string;
  goalTitle: string;
  targetDate: string;
  currentVelocityHoursPerWeek: number;
  inactionCostSummary: string;
  trajectories: GoalProjectionTrajectory[];
}

export class ProjectionsService {
  /**
   * Generates mathematical and narrative 3-trajectory projections for a user goal.
   */
  static async calculateProjections(userId: string, goalId?: string): Promise<FutureYouReport> {
    // 1. Fetch goal or latest active goal
    const goal = await prisma.goal.findFirst({
      where: goalId ? { id: goalId, userId } : { userId, status: "ACTIVE" },
      include: {
        milestones: {
          orderBy: { orderIndex: "asc" },
          include: {
            weeklyTargets: {
              include: {
                tasks: {
                  include: {
                    instances: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!goal) {
      throw new Error("No active goal found to calculate projections");
    }

    // 2. Calculate task completion metrics
    let totalTasks = 0;
    let completedTasks = 0;
    let totalEstimatedMinutes = 0;

    goal.milestones.forEach((m) => {
      m.weeklyTargets.forEach((w) => {
        w.tasks.forEach((t) => {
          totalEstimatedMinutes += t.estimatedMinutes;
          t.instances.forEach((ti) => {
            totalTasks++;
            if (ti.status === "COMPLETED") completedTasks++;
          });
        });
      });
    });

    const completionRate = totalTasks > 0 ? completedTasks / totalTasks : 0.5;
    const targetDateObj = new Date(goal.targetDate);
    const now = new Date();
    const daysRemaining = Math.max(
      14,
      Math.round((targetDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    // 3. Build Trajectory 1: Accelerated (On-Track)
    const acceleratedDaysDelta = -Math.round(daysRemaining * 0.15); // Finishes 15% early
    const acceleratedDate = new Date(targetDateObj);
    acceleratedDate.setDate(acceleratedDate.getDate() + acceleratedDaysDelta);

    const onTrackTrajectory: GoalProjectionTrajectory = {
      trajectory: "ON_TRACK_ACCELERATED",
      title: "Compounding Mastery (Accelerated)",
      projectedCompletionDate: acceleratedDate.toISOString().split("T")[0],
      daysDelta: acceleratedDaysDelta,
      confidenceScore: 88,
      description:
        "You maintain 85%+ consistency and execute your P0 Critical missions during peak energy slots. Cognitive resistance drops as habits consolidate.",
      milestoneOutcomes: goal.milestones.map((m, idx) => {
        const milestoneDate = new Date(m.targetDate);
        milestoneDate.setDate(milestoneDate.getDate() - (idx + 1) * 3);
        return {
          milestoneTitle: m.title,
          projectedDate: milestoneDate.toISOString().split("T")[0],
          status: "EARLY",
        };
      }),
      identityNarrative: `You master "${goal.title}" ahead of schedule. Your identity shifts from someone striving to someone who naturally commands high-scale execution.`,
    };

    // 4. Build Trajectory 2: Baseline (Realistic)
    const baselineDaysDelta = Math.round(daysRemaining * 0.1); // Small 10% life buffer
    const baselineDate = new Date(targetDateObj);
    baselineDate.setDate(baselineDate.getDate() + baselineDaysDelta);

    const baselineTrajectory: GoalProjectionTrajectory = {
      trajectory: "BASELINE_REALISTIC",
      title: "Current Velocity (Realistic)",
      projectedCompletionDate: baselineDate.toISOString().split("T")[0],
      daysDelta: baselineDaysDelta,
      confidenceScore: 78,
      description:
        "Execution continues at your rolling 14-day velocity. Occasional life disruptions occur, but P0 carry-forwards keep milestones generally intact.",
      milestoneOutcomes: goal.milestones.map((m) => ({
        milestoneTitle: m.title,
        projectedDate: new Date(m.targetDate).toISOString().split("T")[0],
        status: "ON_TIME",
      })),
      identityNarrative: `You complete "${goal.title}" near target date with steady competence. Execution becomes predictable and stress-free.`,
    };

    // 5. Build Trajectory 3: Drift (Status Quo Avoidance)
    const driftDaysDelta = Math.round(daysRemaining * 0.65); // Delayed by 65% or stalled
    const driftDate = new Date(targetDateObj);
    driftDate.setDate(driftDate.getDate() + driftDaysDelta);

    const driftTrajectory: GoalProjectionTrajectory = {
      trajectory: "DRIFT_STATUS_QUO",
      title: "Drift & Avoidance (Cost of Inaction)",
      projectedCompletionDate: driftDate.toISOString().split("T")[0],
      daysDelta: driftDaysDelta,
      confidenceScore: 45,
      description:
        "High-complexity tasks get postponed repeatedly. The backlog debt compounds, causing cognitive fatigue and milestone erosion.",
      milestoneOutcomes: goal.milestones.map((m, idx) => {
        const milestoneDate = new Date(m.targetDate);
        milestoneDate.setDate(milestoneDate.getDate() + (idx + 1) * 12);
        return {
          milestoneTitle: m.title,
          projectedDate: milestoneDate.toISOString().split("T")[0],
          status: "DELAYED",
        };
      }),
      identityNarrative:
        goal.costOfInaction ||
        "Progress stalls, leading to regret and accumulated backlog friction.",
    };

    return {
      goalId: goal.id,
      goalTitle: goal.title,
      targetDate: goal.targetDate.toISOString().split("T")[0],
      currentVelocityHoursPerWeek: Math.round((totalEstimatedMinutes / 60 / 2) * 10) / 10,
      inactionCostSummary: goal.costOfInaction || "Stagnation and missed potential",
      trajectories: [onTrackTrajectory, baselineTrajectory, driftTrajectory],
    };
  }
}
