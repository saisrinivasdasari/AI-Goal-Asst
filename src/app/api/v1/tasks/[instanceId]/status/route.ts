import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { MissionService } from "@/features/mission/mission.service";
import { z } from "zod";
import { AppError } from "@/lib/errors";

const UpdateStatusSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "MISSED", "RESCHEDULED", "PRUNED"]),
  actualMinutes: z.number().nonnegative().optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    const { instanceId } = await params;
    const body = await req.json();
    const parsed = UpdateStatusSchema.parse(body);

    const task = await MissionService.updateTaskStatus(
      user.id,
      instanceId,
      parsed.status,
      parsed.actualMinutes,
      parsed.notes
    );

    return NextResponse.json({
      success: true,
      data: task,
      task,
      message: "Task status updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", issues: error.issues } }, { status: 422 });
    }
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

