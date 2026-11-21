import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { MissionService } from "@/features/mission/mission.service";
import { z } from "zod";
import { AppError } from "@/lib/errors";

const TakeLeaveSchema = z.object({
  days: z.number().min(1).max(30).default(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Default days = 1
    }
    const parsed = TakeLeaveSchema.parse(body);
    const result = await MissionService.takeLeave(user.id, parsed.days);
    return NextResponse.json(result);
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
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to apply rest mode" } },
      { status: 500 }
    );
  }
}

