import { NextRequest, NextResponse } from "next/server";
import { WeeklyReviewService } from "@/features/reviews/weekly-review.service";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    const reviews = await WeeklyReviewService.getWeeklyReviews(authUser.id);

    return NextResponse.json({
      success: true,
      data: reviews,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "FETCH_REVIEWS_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    let body = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is valid
    }

    const { userAdjustmentNotes } = body as { userAdjustmentNotes?: string };
    const review = await WeeklyReviewService.generateWeeklyReview(authUser.id, userAdjustmentNotes);

    return NextResponse.json({
      success: true,
      data: review,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "GENERATE_REVIEW_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
