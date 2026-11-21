import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { JournalService } from "@/features/journal/journal.service";
import { z } from "zod";
import { AppError } from "@/lib/errors";

const JournalInputSchema = z.object({
  rawText: z.string().min(3),
  date: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const body = await req.json();
    const parsed = JournalInputSchema.parse(body);

    const result = await JournalService.ingestJournal(user.id, parsed.rawText, parsed.date);
    return NextResponse.json(
      {
        success: true,
        data: result,
        ...result,
      },
      { status: 201 }
    );
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
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to ingest journal" } },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const entries = await JournalService.listEntries(user.id);
    return NextResponse.json({
      success: true,
      data: entries,
      entries,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to list journal entries" } },
      { status: 500 }
    );
  }
}
