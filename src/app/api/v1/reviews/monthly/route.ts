import { NextRequest, NextResponse } from "next/server";
import { MonthlyReviewService } from "@/features/reviews/monthly-review.service";
import { getAuthenticatedUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser();
    const reviews = await MonthlyReviewService.getMonthlyReviews(authUser.id);

    return NextResponse.json({
      success: true,
      data: reviews,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "FETCH_MONTHLY_REVIEWS_FAILED", message: error.message } },
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

    const { identityShiftNotes, userReflections } = body as {
      identityShiftNotes?: string;
      userReflections?: string;
    };
    const review = await MonthlyReviewService.generateMonthlyReview(authUser.id, {
      identityShiftNotes,
      userReflections,
    });

    return NextResponse.json({
      success: true,
      data: review,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { code: "GENERATE_MONTHLY_REVIEW_FAILED", message: error.message } },
      { status: 500 }
    );
  }
}
