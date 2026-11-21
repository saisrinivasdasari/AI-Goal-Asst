import { NextRequest, NextResponse } from "next/server";
import { ProjectionsService } from "@/features/analyst/projections.service";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    const searchParams = request.nextUrl.searchParams;
    const goalId = searchParams.get("goalId") || undefined;

    const report = await ProjectionsService.calculateProjections(authUser.id, goalId);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "PROJECTION_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
