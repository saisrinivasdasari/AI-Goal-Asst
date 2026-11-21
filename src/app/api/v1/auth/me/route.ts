import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const user = await getAuthenticatedUser(true);

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        profile: true,
        capacitySchedule: true,
      },
    }).catch(() => null);

    const fullName = dbUser?.profile?.fullName || user.fullName || user.email.split("@")[0] || "User";
    const initials = fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase() || "U";

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName,
        initials,
        timezone: dbUser?.profile?.timezone || "UTC",
        capacityHoursWeekly: dbUser?.capacitySchedule?.netAvailableGoalHours ?? 60.5,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: { message: err.message || "Unauthorized" } }, { status: 401 });
  }
}

