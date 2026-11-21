import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { MissionService } from "@/features/mission/mission.service";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const mission = await MissionService.getTodaysMission(user.id);

    const summary = {
      total: mission.metrics.totalTasks,
      completed: mission.metrics.completedTasks,
      totalMinutes: mission.metrics.totalPlannedMinutes,
      completedMinutes: mission.metrics.completedMinutes,
    };

    const anchorsMap = new Map<string, { goalId: string; goalTitle: string; whyStatement: string }>();
    mission.tasks.forEach((t: any) => {
      if (t.goalTitle && t.whyReason && !anchorsMap.has(t.goalTitle)) {
        anchorsMap.set(t.goalTitle, {
          goalId: t.taskId || t.instanceId,
          goalTitle: t.goalTitle,
          whyStatement: t.whyReason,
        });
      }
    });

    const enrichedMission = {
      ...mission,
      summary,
      emotionalAnchors: Array.from(anchorsMap.values()),
    };

    return NextResponse.json({
      success: true,
      data: enrichedMission,
      mission: enrichedMission,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load today's mission" } },
      { status: 500 }
    );
  }
}
