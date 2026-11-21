import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { GoalService } from "@/features/goals/goal.service";
import { z } from "zod";
import { AppError } from "@/lib/errors";

const FlexibleEnergyLevelSchema = z.preprocess((val) => {
  if (typeof val !== "string") return "HIGH_FOCUS";
  const upper = val.toUpperCase().trim();
  if (upper.includes("HIGH")) return "HIGH_FOCUS";
  if (upper.includes("LOW") || upper.includes("REC")) return "LOW_RECOVERY";
  return "MEDIUM";
}, z.enum(["HIGH_FOCUS", "MEDIUM", "LOW_RECOVERY"]).default("HIGH_FOCUS"));

const FlexiblePriorityLevelSchema = z.preprocess((val) => {
  if (typeof val !== "string") return "P1_IMPORTANT";
  const upper = val.toUpperCase().trim();
  if (upper.includes("0") || upper.includes("CRIT") || upper.includes("HIGH")) return "P0_CRITICAL";
  if (upper.includes("2") || upper.includes("OPT") || upper.includes("LOW")) return "P2_OPTIONAL";
  return "P1_IMPORTANT";
}, z.enum(["P0_CRITICAL", "P1_IMPORTANT", "P2_OPTIONAL"]).default("P1_IMPORTANT"));

const ConfirmRoadmapSchema = z.object({
  title: z.string().min(1),
  category: z.string().optional().default("CAREER"),
  lifeAreaName: z.string().optional(),
  whyReason: z.string().optional(),
  whyNow: z.string().optional(),
  costOfInaction: z.string().optional(),
  dreamVision: z.string().optional(),
  successDefinition: z.string().optional(),
  targetDate: z.string(),
  estimatedHoursTotal: z.number().optional(),
  milestones: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional(),
      orderIndex: z.number().default(1),
      estimatedWeeksFromStart: z.number().default(1),
      weeklyTargets: z.array(
        z.object({
          title: z.string(),
          targetHours: z.number().default(8),
          tasks: z.array(
            z.object({
              title: z.string(),
              description: z.string().optional(),
              priority: FlexiblePriorityLevelSchema,
              estimatedMinutes: z.number().default(45),
              requiredEnergy: FlexibleEnergyLevelSchema,
            })
          ).min(1),
        })
      ).min(1),
    })
  ).min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const body = await req.json();
    const parsed = ConfirmRoadmapSchema.parse(body);

    const result = await GoalService.confirmRoadmap(user.id, parsed as any);

    return NextResponse.json({
      success: true,
      data: result,
      journey: result,
    }, { status: 201 });
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
    console.error("Confirm roadmap error:", error);
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to confirm and save roadmap" } },
      { status: 500 }
    );
  }
}
