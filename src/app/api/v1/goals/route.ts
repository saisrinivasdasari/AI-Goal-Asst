import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { GoalService } from "@/features/goals/goal.service";
import { z } from "zod";
import { AppError } from "@/lib/errors";

const CreateGoalSchema = z.object({
  title: z.string().min(3),
  lifeAreaName: z.string().optional(),
  category: z.string().optional(),
  dreamVision: z.string().optional(),
  whyReason: z.string().optional(),
  whyStatement: z.string().optional(),
  whyNow: z.string().optional(),
  whyNowStatement: z.string().optional(),
  costOfInaction: z.string().optional(),
  inactionCostStatement: z.string().optional(),
  successDefinition: z.string().optional(),
  targetDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
  estimatedHoursTotal: z.number().positive().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;

    const goals = await GoalService.listGoals(user.id, status);
    return NextResponse.json({
      success: true,
      data: goals,
      goals,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to fetch goals" } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const body = await req.json();
    const parsed = CreateGoalSchema.parse(body);

    const title = parsed.title;
    const whyReason =
      parsed.whyReason || parsed.whyStatement || "Personal mastery and long-term fulfillment";
    const whyNow = parsed.whyNow || parsed.whyNowStatement || "Now is the optimal window to execute";
    const costOfInaction =
      parsed.costOfInaction || parsed.inactionCostStatement || "Stagnation and compounding delay";
    const dreamVision = parsed.dreamVision || title;
    const successDefinition = parsed.successDefinition || `Successfully master and deliver ${title}`;
    const lifeAreaName = parsed.lifeAreaName || parsed.category || "CAREER";
    const estimatedHoursTotal = parsed.estimatedHoursTotal || 40;

    const goal = await GoalService.createGoal(user.id, {
      title,
      lifeAreaName,
      dreamVision,
      whyReason,
      whyNow,
      costOfInaction,
      successDefinition,
      targetDate: parsed.targetDate,
      estimatedHoursTotal,
    });

    return NextResponse.json(
      {
        success: true,
        data: goal,
        goal,
        message: "Goal created and roadmap generated successfully",
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: error.issues.map((i) => i.message).join(", "),
            issues: error.issues,
          },
        },
        { status: 422 }
      );
    }
    if (error instanceof AppError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.statusCode }
      );
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to create goal" } },
      { status: 500 }
    );
  }
}
