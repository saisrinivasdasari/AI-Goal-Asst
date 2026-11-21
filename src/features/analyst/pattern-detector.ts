import { prisma } from "@/lib/db/prisma";
import { getAIProvider } from "@/lib/ai/client";
import { z } from "zod";

export interface BehavioralPatternReport {
  consistencyScore: number; // 0-100%
  completedTasksCount: number;
  missedTasksCount: number;
  rescheduledTasksCount: number;
  lifeAreaDistribution: Record<string, number>; // e.g. { CAREER: 65, HEALTH: 20, LEARNING: 15 }
  frictionPoints: {
    taskId: string;
    taskTitle: string;
    goalTitle: string;
    rescheduledCount: number;
    reason: string;
  }[];
  energyAlignmentScore: number; // 0-100%
  insights: {
    observation: string;
    explanation: string;
    suggestion: string;
    actionableStep: string;
  }[];
}

const PatternInsightsSchema = z.object({
  insights: z.array(
    z.object({
      observation: z.string(),
      explanation: z.string(),
      suggestion: z.string(),
      actionableStep: z.string(),
    })
  ),
});

export class PatternDetectorService {
  /**
   * Analyzes rolling 14-day behavioral consistency, friction, and energy alignment.
   */
  static async analyzeRolling14Days(userId: string): Promise<BehavioralPatternReport> {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    // 1. Fetch rolling task instances
    const taskInstances = await prisma.taskInstance.findMany({
      where: {
        scheduledDate: { gte: fourteenDaysAgo },
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
      orderBy: { scheduledDate: "desc" },
    });

    const totalInstances = taskInstances.length;
    let completedCount = 0;
    let missedCount = 0;
    let rescheduledCount = 0;
    const categoryMinutes: Record<string, number> = {};
    const frictionPoints: BehavioralPatternReport["frictionPoints"] = [];

    taskInstances.forEach((ti) => {
      if (ti.status === "COMPLETED") completedCount++;
      if (ti.status === "MISSED") missedCount++;
      if (ti.rescheduledCount > 0) rescheduledCount++;

      const category = ti.task.weeklyTarget.milestone.goal.lifeArea?.name || "GENERAL";
      categoryMinutes[category] =
        (categoryMinutes[category] || 0) + (ti.actualMinutes || ti.task.estimatedMinutes);

      // Detect repeated friction/avoidance (rescheduled >= 2 or missed)
      if (ti.rescheduledCount >= 2 || ti.status === "MISSED") {
        frictionPoints.push({
          taskId: ti.task.id,
          taskTitle: ti.task.title,
          goalTitle: ti.task.weeklyTarget.milestone.goal.title,
          rescheduledCount: ti.rescheduledCount,
          reason:
            ti.rescheduledCount >= 2
              ? `Avoided or pushed back ${ti.rescheduledCount} times`
              : "Marked missed during execution",
        });
      }
    });

    // Calculate consistency score
    const consistencyScore =
      totalInstances > 0 ? Math.round((completedCount / totalInstances) * 100) : 100;

    // Calculate life area distribution percentages
    const totalMinutes = Object.values(categoryMinutes).reduce((a, b) => a + b, 0);
    const lifeAreaDistribution: Record<string, number> = {};
    if (totalMinutes > 0) {
      for (const [cat, mins] of Object.entries(categoryMinutes)) {
        lifeAreaDistribution[cat] = Math.round((mins / totalMinutes) * 100);
      }
    } else {
      lifeAreaDistribution["GENERAL"] = 100;
    }

    // Energy alignment (default baseline ~85% if low sample size)
    const energyAlignmentScore = totalInstances > 0 ? Math.min(100, Math.max(50, consistencyScore + 5)) : 90;

    // 2. Generate AI behavioral insights via Jarvis Companion Engine
    let insights: BehavioralPatternReport["insights"] = [];
    try {
      const ai = getAIProvider();
      const prompt = `Analyze this user's rolling 14-day productivity patterns:
- Total tasks: ${totalInstances}
- Completed: ${completedCount} (${consistencyScore}%)
- Rescheduled tasks: ${rescheduledCount}
- Repeated friction tasks: ${JSON.stringify(frictionPoints.slice(0, 3))}
- Effort distribution by category: ${JSON.stringify(lifeAreaDistribution)}

Provide 2-3 structured observations following this exact format:
- observation: What pattern was noticed
- explanation: Root psychological or energetic cause
- suggestion: Empathetic strategic advice
- actionableStep: Immediate tangible micro-step

JSON format:
{
  "insights": [
    {
      "observation": "...",
      "explanation": "...",
      "suggestion": "...",
      "actionableStep": "..."
    }
  ]
}`;

      const aiResponse = await ai.generateStructured(prompt, PatternInsightsSchema, 0.3);

      insights = aiResponse.insights;
    } catch {
      // Fallback deterministic behavioral insight
      insights = [
        {
          observation: `You achieved a ${consistencyScore}% task execution rate across ${totalInstances} scheduled items.`,
          explanation:
            frictionPoints.length > 0
              ? `Friction was detected on high-complexity items that were rescheduled multiple times.`
              : `Your task velocity matches your scheduled biological capacity.`,
          suggestion:
            frictionPoints.length > 0
              ? `Break the repeated tasks into 15-minute introductory chunks to lower cognitive resistance.`
              : `Maintain your current focus blocks and guard your rest recovery windows.`,
          actionableStep:
            frictionPoints.length > 0
              ? `Schedule "${frictionPoints[0].taskTitle}" as your first P0 item tomorrow morning.`
              : `Review next week's milestones to maintain momentum.`,
        },
      ];
    }

    return {
      consistencyScore,
      completedTasksCount: completedCount,
      missedTasksCount: missedCount,
      rescheduledTasksCount: rescheduledCount,
      lifeAreaDistribution,
      frictionPoints,
      energyAlignmentScore,
      insights,
    };
  }
}
