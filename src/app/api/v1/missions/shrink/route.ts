import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { MissionService } from "@/features/mission/mission.service";
import { AppError } from "@/lib/errors";
import { z } from "zod";

const ShrinkSchema = z.object({
  taskInstanceId: z.string().min(1, "taskInstanceId is required"),
  targetMinutes: z.number().int().min(5).max(60).default(10),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const body = await req.json();
    const { taskInstanceId, targetMinutes } = ShrinkSchema.parse(body);

    const result = await MissionService.shrinkTaskToMicroStep(user.id, taskInstanceId, targetMinutes);
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", issues: error.issues } },
        { status: 422 }
      );
    }
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to shrink task" } },
      { status: 500 }
    );
  }
}

