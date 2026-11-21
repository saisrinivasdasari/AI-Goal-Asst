import { describe, it, expect, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { GoalService } from "@/features/goals/goal.service";
import { prisma } from "@/lib/db/prisma";
import * as aiClient from "@/lib/ai/client";

describe("Goal Management Unit Tests (Delete & Update)", () => {
  it("should throw NotFoundError if goal does not exist when deleting", async () => {
    vi.spyOn(prisma.goal, "findFirst").mockResolvedValueOnce(null);

    await expect(
      GoalService.deleteGoal("user-1", "non-existent-goal")
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw NotFoundError if goal does not exist when updating", async () => {
    vi.spyOn(prisma.goal, "findFirst").mockResolvedValueOnce(null);

    await expect(
      GoalService.updateGoal("user-1", "non-existent-goal", { title: "New Title" })
    ).rejects.toThrow(NotFoundError);
  });

  it("should incorporate custom syllabus into prompt during previewRoadmapWithAI", async () => {
    const mockAI = {
      generateStructured: vi.fn().mockResolvedValue({
        milestones: [
          {
            title: "Phase 1: Container Orchestration",
            description: "Custom outcome",
            orderIndex: 1,
            estimatedWeeksFromStart: 1,
            weeklyTargets: [
              {
                title: "Custom Target 1",
                targetHours: 8,
                tasks: [
                  {
                    title: "Learn Docker containerization basics",
                    description: "From custom syllabus",
                    priority: "P0_CRITICAL",
                    estimatedMinutes: 60,
                    requiredEnergy: "HIGH_FOCUS",
                  },
                ],
              },
            ],
          },
        ],
      }),
    };

    vi.spyOn(aiClient, "getAIProvider").mockReturnValue(mockAI as any);

    const result = await GoalService.previewRoadmapWithAI("user-1", {
      title: "DevOps Mastery",
      durationWeeks: 2,
      weeklyHours: 8,
      customRoadmapText: "• Chapter 1: Docker Containers\n• Chapter 2: Kubernetes Pods",
    });

    expect(mockAI.generateStructured).toHaveBeenCalled();
    const calledPrompt = mockAI.generateStructured.mock.calls[0][0];
    expect(calledPrompt).toContain("Chapter 1: Docker Containers");
    expect(calledPrompt).toContain("Chapter 2: Kubernetes Pods");
    expect(result.milestones[0].title).toBe("Phase 1: Container Orchestration");
    expect(result.milestones[0].weeklyTargets[0].tasks[0].title).toBe("Learn Docker containerization basics");
  });
});

