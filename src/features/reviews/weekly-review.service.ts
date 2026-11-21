import { prisma } from "@/lib/db/prisma";
import { getAIProvider } from "@/lib/ai/client";
import { z } from "zod";

const WeeklyReviewSynthesisSchema = z.object({
  blockerObservations: z.string(),
  aiSuggestion: z.string(),
  recommendedCapacityHours: z.number(),
});

export class WeeklyReviewService {
  /**
   * Generates and persists a tactical weekly review for the given user.
   */
  static async generateWeeklyReview(userId: string, userAdjustmentNotes?: string) {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);
    startOfWeek.setHours(0, 0, 0, 0);

    // 1. Fetch completed & missed task instances from the past week
    const taskInstances = await prisma.taskInstance.findMany({
      where: {
        scheduledDate: { gte: startOfWeek, lte: now },
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
        task: true,
      },
    });

    let completedTasksCount = 0;
    let missedTasksCount = 0;
    let totalPlannedHours = 0;
    let totalActualHours = 0;

    taskInstances.forEach((ti) => {
      totalPlannedHours += ti.task.estimatedMinutes / 60;
      if (ti.status === "COMPLETED") {
        completedTasksCount++;
        totalActualHours += (ti.actualMinutes || ti.task.estimatedMinutes) / 60;
      } else if (ti.status === "MISSED") {
        missedTasksCount++;
      }
    });

    // 2. Fetch journal entries from this week to inspect blockers
    const journals = await prisma.journalEntry.findMany({
      where: {
        userId,
        createdAt: { gte: startOfWeek },
      },
      include: {
        items: true,
      },
      take: 5,
    });

    const journalContext = journals
      .map((j) => `[${j.entryDate.toISOString().split("T")[0]}] Mood: ${j.detectedMood}. ${j.rawInputText}`)
      .join("\n");

    // 3. AI synthesis via Ollama
    let blockerObservations = "Execution proceeded with minimal recorded friction.";
    let aiSuggestion =
      "Great week. Maintain your high-focus morning slots and continue executing on your primary milestone.";

    try {
      const ai = getAIProvider();
      const prompt = `You are Jarvis, an elite Life OS and executive coach. Perform a Weekly Tactical Review:
- Tasks Completed: ${completedTasksCount}
- Tasks Missed: ${missedTasksCount}
- Planned Hours: ${totalPlannedHours.toFixed(1)}h
- Actual Logged Hours: ${totalActualHours.toFixed(1)}h
- Journal Reflections from this week:
${journalContext || "No specific blockers journaled."}

Provide a concise, empathetic review in JSON:
{
  "blockerObservations": "Summary of friction or energy dips noticed",
  "aiSuggestion": "Actionable strategy for next week's focus and capacity rebalancing",
  "recommendedCapacityHours": 40
}`;

      const aiResponse = await ai.generateStructured(prompt, WeeklyReviewSynthesisSchema, 0.3);

      blockerObservations = aiResponse.blockerObservations;
      aiSuggestion = aiResponse.aiSuggestion;
    } catch {
      // Keep sensible default if model is busy
    }

    // 4. Persist to database
    const review = await prisma.weeklyReview.create({
      data: {
        userId,
        weekStartDate: startOfWeek,
        totalPlannedHours: Math.round(totalPlannedHours * 10) / 10,
        totalActualHours: Math.round(totalActualHours * 10) / 10,
        completedTasksCount,
        missedTasksCount,
        blockerObservations,
        aiSuggestion,
        userAdjustmentNotes: userAdjustmentNotes || null,
      },
    });

    return review;
  }

  /**
   * Fetches past weekly reviews.
   */
  static async getWeeklyReviews(userId: string) {
    return prisma.weeklyReview.findMany({
      where: { userId },
      orderBy: { weekStartDate: "desc" },
      take: 10,
    });
  }
}
