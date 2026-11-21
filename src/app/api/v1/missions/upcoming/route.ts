import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { MissionService } from "@/features/mission/mission.service";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const tasks = await MissionService.getUpcomingTasks(user.id);
    return NextResponse.json({
      success: true,
      data: tasks,
      tasks,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load upcoming tasks" } },
      { status: 500 }
    );
  }
}

