import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import { GeminiProviderAdapter } from "@/lib/ai/gemini-adapter";
import { getAIProvider, resetAIProvider } from "@/lib/ai/client";
import { AIInferenceError } from "@/lib/errors";

describe("GeminiProviderAdapter Unit Tests", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetAIProvider();
    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-fake-key-12345";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("should instantiate GeminiProviderAdapter via getAIProvider when AI_PROVIDER=gemini", () => {
    const provider = getAIProvider();
    expect(provider).toBeInstanceOf(GeminiProviderAdapter);
  });

  it("should throw AIInferenceError if GEMINI_API_KEY is missing", async () => {
    delete process.env.GEMINI_API_KEY;
    const adapter = new GeminiProviderAdapter();

    await expect(adapter.embedText("test")).rejects.toThrow(AIInferenceError);
  });

  it("should parse structured JSON conforming to Zod schema", async () => {
    const adapter = new GeminiProviderAdapter();
    const TestSchema = z.object({
      category: z.string(),
      score: z.number(),
    });

    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: JSON.stringify({ category: "Fitness", score: 95 }) }],
          },
          finishReason: "STOP",
        },
      ],
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as unknown as Response);

    const result = await adapter.generateStructured("extract data", TestSchema);
    expect(result).toEqual({ category: "Fitness", score: 95 });
  });

  it("should repair malformed JSON during generateStructured", async () => {
    const adapter = new GeminiProviderAdapter();
    const TestSchema = z.object({
      tags: z.array(z.string()),
    });

    // Malformed JSON with trailing comma
    const mockResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: '{"tags": ["health", "workout",]}' }],
          },
          finishReason: "STOP",
        },
      ],
    };

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as unknown as Response);

    const result = await adapter.generateStructured("extract tags", TestSchema);
    expect(result).toEqual({ tags: ["health", "workout"] });
  });

  it("should return a 768-dimensional embedding vector", async () => {
    const adapter = new GeminiProviderAdapter();
    const mockVector = new Array(768).fill(0.01);

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        embedding: {
          values: mockVector,
        },
      }),
    } as unknown as Response);

    const embedding = await adapter.embedText("Daily workout routine");
    expect(embedding).toHaveLength(768);
    expect(embedding[0]).toBe(0.01);
  });

  it("should stream chat chunks and emit connected, content, and metrics events", async () => {
    const adapter = new GeminiProviderAdapter();

    const ssePayload = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Hello"}]},"index":0}]}',
      'data: {"candidates":[{"content":{"parts":[{"text":" World!"}]},"finishReason":"STOP","index":0}],"usageMetadata":{"candidatesTokenCount":5}}',
      "",
    ].join("\n\n");

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(ssePayload));
        controller.close();
      },
    });

    vi.spyOn(global, "fetch").mockResolvedValueOnce({
      ok: true,
      body: stream,
    } as unknown as Response);

    const responseStream = await adapter.streamChat({
      messages: [{ role: "user", content: "Hi" }],
      systemPrompt: "You are Jarvis.",
    });

    const reader = responseStream.getReader();
    const decoder = new TextDecoder();
    let accumulatedText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      accumulatedText += decoder.decode(value);
    }

    expect(accumulatedText).toContain(": connected");
    expect(accumulatedText).toContain('"content":"Hello"');
    expect(accumulatedText).toContain('"content":" World!"');
    expect(accumulatedText).toContain('"type":"metrics"');
    expect(accumulatedText).toContain("data: [DONE]");
  });
});

