import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { MissionService } from "@/features/mission/mission.service";
import { AppError } from "@/lib/errors";

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    let taskInstanceId: string | undefined;
    try {
      const body = await req.json();
      taskInstanceId = body?.taskInstanceId;
    } catch {
      // Body is optional
    }
    const result = await MissionService.pullForwardNextTask(user.id, taskInstanceId);
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

