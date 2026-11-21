import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { MissionService } from "@/features/mission/mission.service";
import { AppError } from "@/lib/errors";

export async function POST() {
  try {
    const user = await getAuthenticatedUser();
    const result = await MissionService.pullForwardNextTask(user.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to pull forward task" } },
      { status: 500 }
    );
  }
}

