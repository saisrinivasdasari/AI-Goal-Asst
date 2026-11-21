import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { JournalService } from "@/features/journal/journal.service";
import { AppError } from "@/lib/errors";

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const vault = await JournalService.getKnowledgeVault(user.id);
    return NextResponse.json({
      success: true,
      data: vault,
      ...vault,
    });
  } catch (error: any) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: error.message || "Failed to load knowledge vault" } },
      { status: 500 }
    );
  }
}

