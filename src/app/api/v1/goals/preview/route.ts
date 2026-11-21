import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { GoalService } from "@/features/goals/goal.service";
import { z } from "zod";
import { AppError } from "@/lib/errors";

const PreviewRoadmapSchema = z.object({
  title: z.string().min(1, "Goal title is required"),
  category: z.string().optional().default("CAREER"),
  durationWeeks: z.number().min(1).max(52).default(4),
  weeklyHours: z.number().min(1).max(60).default(8),
  whyReason: z.string().optional(),
  whyNow: z.string().optional(),
  costOfInaction: z.string().optional(),
  customRoadmapText: z.string().max(10000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const body = await req.json();
    const parsed = PreviewRoadmapSchema.parse(body);

    const preview = await GoalService.previewRoadmapWithAI(user.id, {
      title: parsed.title,
      category: parsed.category,
      durationWeeks: parsed.durationWeeks,
      weeklyHours: parsed.weeklyHours,
      whyReason: parsed.whyReason,
      whyNow: parsed.whyNow,
      costOfInaction: parsed.costOfInaction,
      customRoadmapText: parsed.customRoadmapText,
    });

    return NextResponse.json({
      success: true,
      data: preview,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", issues: error.issues } },
        { status: 422 }
      );
    }
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    console.error("Preview roadmap error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to preview roadmap" } },
      { status: 500 }
    );
  }
}
