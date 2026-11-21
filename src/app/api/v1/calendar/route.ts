import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { CalendarService } from "@/features/calendar/calendar.service";
import { AppError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || undefined;
    const goalId = searchParams.get("goalId") || undefined;

    const tasks = await CalendarService.getCalendarTasks(user.id, {
      month,
      goalId,
    });

    return NextResponse.json({
      success: true,
      tasks,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: { message: error.message || "Failed to load calendar tasks" } },
      { status: 500 }
    );
  }
}

