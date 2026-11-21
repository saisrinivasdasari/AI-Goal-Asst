import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { CalendarService } from "@/features/calendar/calendar.service";
import { AppError } from "@/lib/errors";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser();
    const { id } = await params;
    const body = await req.json();

    const updated = await CalendarService.updateTaskInstance(user.id, id, {
      status: body.status,
      scheduledDate: body.scheduledDate,
    });

    return NextResponse.json({
      success: true,
      task: updated,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to update task" } },
      { status: 500 }
    );
  }
}

