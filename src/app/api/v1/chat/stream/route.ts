import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getAIProvider } from "@/lib/ai/client";
import { JARVIS_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { PersonalStateService } from "@/features/analyst/personal-state.service";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { AppError } from "@/lib/errors";

const ChatRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const body = await req.json();
    const parsed = ChatRequestSchema.parse(body);

    // 1. Get or create session
    let sessionId = parsed.sessionId;
    if (!sessionId) {
      const newSession = await prisma.chatSession.create({
        data: {
          userId: user.id,
          title: parsed.message.substring(0, 40) + "...",
        },
      });
      sessionId = newSession.id;
    }

    // Save user message
    await prisma.chatMessage.create({
      data: {
        sessionId,
        role: "user",
        content: parsed.message,
      },
    });

    // 2. Fetch Personal State Snapshot for Context Grounding (compact for low latency)
    const state = await PersonalStateService.getSnapshot(user.id);
    const compactSummary = [
      `Capacity: ${state.capacity.netAvailableHours}h/wk (Energy: ${state.capacity.currentEnergyLevel})`,
      `Goals: ${state.activeGoals.slice(0, 3).map((g) => g.title).join(", ") || "None"}`,
      `Today: ${state.todaysMission.tasks.slice(0, 3).map((t) => t.title).join(", ") || "All clear"}`,
    ].join(" | ");

    const systemPromptWithState = `${JARVIS_SYSTEM_PROMPT}

<user_state>
${compactSummary}
</user_state>

Directives: Respond directly with grounded, empathetic warmth. Keep responses focused and concise (1-3 paragraphs maximum). Do not output reasoning or meta-commentary.`;

    // 3. Fetch recent conversation history (limited to 4 messages for rapid CPU prompt eval)
    const history = await prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: 4,
    });
    const chronologicalHistory = history.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));

    // 4. Stream response from AI Provider with thinking bypassed and 30m warm memory
    const ai = getAIProvider();
    const stream = await ai.streamChat({
      systemPrompt: systemPromptWithState,
      messages: chronologicalHistory,
      temperature: 0.6,
      maxTokens: 384,
      disableThinking: true,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
        "X-Session-Id": sessionId,
      },
    });
  } catch (error: any) {
    console.error("[Chat Stream Route Error]:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", issues: error.issues } }, { status: 422 });
    }
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}

