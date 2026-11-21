import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { AdaptiveReschedulerService } from "@/features/analyst/rescheduler.service";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { AppError } from "@/lib/errors";

const RescheduleSchema = z.object({
  missedTaskInstanceId: z.string().optional(),
  preferredDate: z.string().optional(),
  strategy: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    let body = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is valid
    }
    const parsed = RescheduleSchema.parse(body);

    let targetId = parsed.missedTaskInstanceId;
    if (!targetId) {
      const pendingTask = await prisma.taskInstance.findFirst({
        where: {
          task: { weeklyTarget: { milestone: { goal: { userId: user.id } } } },
          status: { in: ["PENDING", "MISSED"] },
        },
        orderBy: { scheduledDate: "asc" },
      });
      targetId = pendingTask?.id;
    }

    if (!targetId) {
      return NextResponse.json({
        success: true,
        data: {
          action: "NOOP_OPTIMIZED",
          jarvisExplanation: "All active tasks are currently in balance with your available capacity. No backlog detected.",
        },
      });
    }

    const result = await AdaptiveReschedulerService.rescheduleMissedTask(user.id, {
      missedTaskInstanceId: targetId,
      preferredDate: parsed.preferredDate,
    });

    return NextResponse.json({
      success: true,
      data: result,
      ...result,
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
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to reschedule" } },
      { status: 500 }
    );
  }
}
