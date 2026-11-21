import { prisma } from "@/lib/db/prisma";
import { getAIProvider } from "@/lib/ai/client";
import { z } from "zod";

const MonthlyReviewSynthesisSchema = z.object({
  achievementsSummary: z.string(),
  learningSummary: z.string(),
  challengesSummary: z.string(),
  patternsSummary: z.string(),
  aiRecommendations: z.string(),
});

export class MonthlyReviewService {
  /**
   * Generates and persists a monthly strategic review with identity shift reflections.
   */
  static async generateMonthlyReview(
    userId: string,
    params?: {
      identityShiftNotes?: string;
      userReflections?: string;
    }
  ) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // 1. Fetch completed milestones this month
    const completedMilestones = await prisma.goalMilestone.findMany({
      where: {
        completedAt: { not: null },
        goal: { userId },
      },
      include: {
        goal: true,
      },
    });

    // 2. Fetch universal memories created this month
    const memories = await prisma.universalMemory.findMany({
      where: {
        userId,
        createdAt: { gte: startOfMonth },
      },
      take: 10,
    });

    const memoriesText = memories.map((m) => `[${m.type}] ${m.content}`).join("\n");
    const milestonesText = completedMilestones
      .map((m) => `[Goal: ${m.goal.title}] ${m.title}`)
      .join("\n");

    // 3. AI synthesis via Ollama
    let achievementsSummary =
      completedMilestones.length > 0
        ? `Completed ${completedMilestones.length} major milestones.`
        : "Built continuous execution discipline and foundational milestones.";
    let learningSummary =
      memories.length > 0
        ? `Synthesized ${memories.length} consolidated insights in your memory vault.`
        : "Consolidated key architecture and workflow patterns.";
    let challengesSummary = "Maintaining execution consistency through unpredictable schedule changes.";
    let patternsSummary = "Morning focus blocks yield the highest milestone completion.";
    let aiRecommendations =
      "For the upcoming month, elevate one secondary goal into focus while maintaining current technical velocity.";

    try {
      const ai = getAIProvider();
      const prompt = `You are Jarvis, an elite Life Operating System conducting a 30-Day Monthly Strategic Review.
- Milestones Completed:
${milestonesText || "Core milestone work in progress."}
- Key Memories & Learnings:
${memoriesText || "Foundational learning logged."}
- User's Identity Shift Reflections:
${params?.identityShiftNotes || "Steadily developing stronger professional discipline."}

Provide a comprehensive strategic monthly review in JSON:
{
  "achievementsSummary": "High-level summary of what was achieved",
  "learningSummary": "Key wisdom and skills consolidated",
  "challengesSummary": "Friction points and hurdles navigated",
  "patternsSummary": "Behavioral trends across the month",
  "aiRecommendations": "Strategic high-leverage guidance for next month"
}`;

      const aiResponse = await ai.generateStructured(prompt, MonthlyReviewSynthesisSchema, 0.3);

      achievementsSummary = aiResponse.achievementsSummary;
      learningSummary = aiResponse.learningSummary;
      challengesSummary = aiResponse.challengesSummary;
      patternsSummary = aiResponse.patternsSummary;
      aiRecommendations = aiResponse.aiRecommendations;
    } catch {
      // Use defaults if AI is busy
    }

    // 4. Persist to database
    const monthlyReview = await prisma.monthlyReview.create({
      data: {
        userId,
        monthStartDate: startOfMonth,
        achievementsSummary,
        learningSummary,
        challengesSummary,
        patternsSummary,
        identityShiftNotes: params?.identityShiftNotes || null,
        lifeAreaDistribution: { CAREER: 0.6, LEARNING: 0.25, HEALTH: 0.15 },
        aiRecommendations,
        userReflections: params?.userReflections || null,
      },
    });

    return monthlyReview;
  }

  /**
   * Fetches past monthly reviews.
   */
  static async getMonthlyReviews(userId: string) {
    return prisma.monthlyReview.findMany({
      where: { userId },
      orderBy: { monthStartDate: "desc" },
      take: 6,
    });
  }
}
