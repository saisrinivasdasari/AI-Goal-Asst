import { NextRequest, NextResponse } from "next/server";
import { PatternDetectorService } from "@/features/analyst/pattern-detector";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    const report = await PatternDetectorService.analyzeRolling14Days(authUser.id);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "PATTERN_ANALYSIS_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
