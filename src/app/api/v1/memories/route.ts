import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { prisma } from "@/lib/db/prisma";
import { getAIProvider } from "@/lib/ai/client";
import { AppError, ValidationError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";
    const type = searchParams.get("type") || undefined;
    const limit = parseInt(searchParams.get("limit") || "10", 10);

    if (query) {
      // Execute PostgreSQL Hybrid Search via match_memories_hybrid
      const ai = getAIProvider();
      const queryEmbedding = await ai.embedText(query, "query");

      const rawResults = await prisma.$queryRaw<
        Array<{
          id: string;
          topic: string;
          content: string;
          memory_type: string;
          combined_score: number;
        }>
      >`
        SELECT * FROM match_memories_hybrid(
          ${query},
          ${queryEmbedding}::vector,
          ${limit},
          ${user.id}
        );
      `;

      return NextResponse.json({
        success: true,
        data: rawResults,
        memories: rawResults,
        searchMode: "HYBRID_RRF",
      });
    }

    // Default list
    const memories = await prisma.universalMemory.findMany({
      where: {
        userId: user.id,
        ...(type ? { type: type as any } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({
      success: true,
      data: memories,
      memories,
      searchMode: "STANDARD",
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic");
    const confirm = searchParams.get("confirm");

    if (!topic) {
      throw new ValidationError("Topic query parameter is required to bulk forget memories.");
    }

    if (confirm !== "true") {
      throw new ValidationError("Confirmation is required (?confirm=true) to forget an entire topic.");
    }

    // Bulk forget topic
    const deleted = await prisma.universalMemory.deleteMany({
      where: {
        userId: user.id,
        topic: { contains: topic, mode: "insensitive" },
      },
    });

    return NextResponse.json({
      deletedCount: deleted.count,
      message: `Successfully forgotten all ${deleted.count} memory items associated with topic "${topic}".`,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

