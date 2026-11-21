import { jsonrepair } from "jsonrepair";
import { ZodSchema } from "zod";
import {
  IAIProvider,
  ChatMessageDTO,
  SearchResultDTO,
  ChatStreamOptions,
} from "./types";
import { AIInferenceError } from "../errors";
import { logger } from "../logger";

export class GeminiProviderAdapter implements IAIProvider {
  private apiKey: string;
  private baseUrl: string;
  private chatModel: string;
  private embeddingModel: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.baseUrl = (process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");
    this.chatModel = (process.env.GEMINI_CHAT_MODEL || "gemini-3.5-flash-lite").replace(/^models\//, "");
    this.embeddingModel = (process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001").replace(/^models\//, "");
  }

  private ensureApiKey() {
    if (!this.apiKey) {
      throw new AIInferenceError("GEMINI_API_KEY is missing. Please set it in .env.local or production environment.");
    }
  }

  /**
   * Transforms generic ChatMessageDTO list and options into Google Gemini contents and systemInstruction
   */
  private formatGeminiPayload(options: ChatStreamOptions) {
    const systemParts: string[] = [];
    if (options.systemPrompt?.trim()) {
      systemParts.push(options.systemPrompt.trim());
    }

    const rawContents: { role: "user" | "model"; text: string }[] = [];

    for (const msg of options.messages) {
      if (msg.role === "system") {
        if (msg.content?.trim()) {
          systemParts.push(msg.content.trim());
        }
      } else {
        const role = msg.role === "assistant" ? "model" : "user";
        rawContents.push({ role, text: msg.content || "" });
      }
    }

    // Combine consecutive messages with the same role to conform to Gemini turn structure
    const contents: { role: "user" | "model"; parts: { text: string }[] }[] = [];
    for (const item of rawContents) {
      const last = contents[contents.length - 1];
      if (last && last.role === item.role) {
        last.parts.push({ text: item.text });
      } else {
        contents.push({ role: item.role, parts: [{ text: item.text }] });
      }
    }

    // Ensure contents are not empty
    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: "Hello" }] });
    }

    // If first message is model, prepend an introductory user prompt to satisfy Gemini's turn ordering
    if (contents[0].role === "model") {
      contents.unshift({ role: "user", parts: [{ text: "Continue" }] });
    }

    const systemInstruction = systemParts.length > 0
      ? { parts: [{ text: systemParts.join("\n\n") }] }
      : undefined;

    return { systemInstruction, contents };
  }

  /**
   * Streams chat responses via Google Gemini streamGenerateContent SSE endpoint
   */
  async streamChat(options: ChatStreamOptions): Promise<ReadableStream<Uint8Array>> {
    this.ensureApiKey();
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    let candidatesTokenCount = 0;
    let metricsEmitted = false;

    const { systemInstruction, contents } = this.formatGeminiPayload(options);

    const payload: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? 1024,
      },
    };

    if (systemInstruction) {
      payload.systemInstruction = systemInstruction;
    }

    const url = `${this.baseUrl}/models/${this.chatModel}:streamGenerateContent?alt=sse&key=${this.apiKey}`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        const errorText = await response.text().catch(() => "");
        throw new AIInferenceError(
          `Gemini chat request failed with status: ${response.status} - ${errorText}`,
          { status: response.status }
        );
      }

      const decoder = new TextDecoder("utf-8");
      const encoder = new TextEncoder();
      let buffer = "";

      const transformStream = new TransformStream<Uint8Array, Uint8Array>({
        start(controller) {
          // Immediately flush initial SSE preamble so HTTP connection opens instantly
          controller.enqueue(encoder.encode(": connected\n\n"));
        },
        transform(chunk, controller) {
          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const jsonStr = trimmed.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);

              // Extract text content from parts
              const candidate = parsed.candidates?.[0];
              const parts = candidate?.content?.parts || [];
              for (const part of parts) {
                if (part.text && part.text.length > 0) {
                  if (firstTokenTime === null) {
                    firstTokenTime = Date.now();
                  }
                  const sseData = `data: ${JSON.stringify({ type: "content", content: part.text })}\n\n`;
                  controller.enqueue(encoder.encode(sseData));
                }
              }

              // Track token count metadata if provided
              if (parsed.usageMetadata?.candidatesTokenCount) {
                candidatesTokenCount = parsed.usageMetadata.candidatesTokenCount;
              }

              // If candidate signaled finish, emit metrics and DONE
              if (candidate?.finishReason === "STOP" || candidate?.finishReason === "MAX_TOKENS") {
                if (!metricsEmitted) {
                  metricsEmitted = true;
                  const ttftMs = firstTokenTime ? firstTokenTime - startTime : undefined;
                  const totalDurationMs = Date.now() - startTime;
                  const evalDurationSec = totalDurationMs / 1000;
                  const tokensPerSecond =
                    evalDurationSec > 0 && candidatesTokenCount > 0
                      ? Number((candidatesTokenCount / evalDurationSec).toFixed(1))
                      : undefined;

                  const metricsPayload = {
                    type: "metrics",
                    metrics: {
                      ttftMs,
                      totalDurationMs,
                      evalCount: candidatesTokenCount,
                      tokensPerSecond,
                    },
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(metricsPayload)}\n\n`));
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                }
              }
            } catch {
              // Ignore partial JSON chunks
            }
          }
        },
        flush(controller) {
          if (!metricsEmitted) {
            metricsEmitted = true;
            const ttftMs = firstTokenTime ? firstTokenTime - startTime : undefined;
            const totalDurationMs = Date.now() - startTime;
            const evalDurationSec = totalDurationMs / 1000;
            const tokensPerSecond =
              evalDurationSec > 0 && candidatesTokenCount > 0
                ? Number((candidatesTokenCount / evalDurationSec).toFixed(1))
                : undefined;

            const metricsPayload = {
              type: "metrics",
              metrics: {
                ttftMs,
                totalDurationMs,
                evalCount: candidatesTokenCount,
                tokensPerSecond,
              },
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(metricsPayload)}\n\n`));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          }
        },
      });

      return response.body.pipeThrough(transformStream);
    } catch (error) {
      logger.error({ error }, "Error connecting to Gemini streaming chat");
      throw error instanceof AIInferenceError
        ? error
        : new AIInferenceError("Failed to communicate with Google Gemini API", {
            originalError: error instanceof Error ? error.message : String(error),
          });
    }
  }

  /**
   * Generates a 768-dimensional dense vector using gemini-embedding-001.
   * Directly compatible with Supabase PostgreSQL pgvector(768).
   */
  async embedText(text: string, _mode: "document" | "query" = "document"): Promise<number[]> {
    this.ensureApiKey();
    const url = `${this.baseUrl}/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`;

    const payload = {
      content: {
        parts: [{ text: text.trim() }],
      },
      outputDimensionality: 768,
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new AIInferenceError(`Gemini embedding request failed: ${response.statusText} - ${errorText}`, {
          status: response.status,
        });
      }

      const data = await response.json();
      const values = data.embedding?.values;
      if (!values || !Array.isArray(values)) {
        throw new AIInferenceError("Gemini did not return a valid embedding vector");
      }

      return values;
    } catch (error) {
      logger.error({ error, text: text.substring(0, 50) }, "Failed to generate text embedding via Gemini");
      throw error instanceof AIInferenceError
        ? error
        : new AIInferenceError("Error computing embedding vector via Gemini", {
            originalError: error instanceof Error ? error.message : String(error),
          });
    }
  }

  /**
   * Extracts structured data with guaranteed Zod validation using responseMimeType: "application/json"
   */
  async generateStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    temperature: number = 0.1
  ): Promise<T> {
    this.ensureApiKey();
    const url = `${this.baseUrl}/models/${this.chatModel}:generateContent?key=${this.apiKey}`;

    const payload = {
      systemInstruction: {
        parts: [
          {
            text: "You are a strict data extraction engine. Output ONLY valid, raw JSON conforming to the requested schema. Do not include markdown codeblocks (no ```json). No conversational filler.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        temperature,
        maxOutputTokens: 2048,
      },
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(30000), // Fast 30s timeout for cloud API
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        throw new AIInferenceError(`Gemini structured extraction failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      let rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();

      // Clean markdown fences if any
      rawText = rawText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

      // Locate outermost JSON structure
      const firstBrace = rawText.indexOf("{");
      const lastBrace = rawText.lastIndexOf("}");
      let jsonString =
        firstBrace !== -1 && lastBrace > firstBrace
          ? rawText.substring(firstBrace, lastBrace + 1)
          : rawText;

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(jsonString);
      } catch {
        // Robust automatic repair for unclosed brackets or trailing commas
        try {
          const repaired = jsonrepair(jsonString);
          parsedJson = JSON.parse(repaired);
        } catch (repairErr) {
          logger.error({ repairErr, rawText }, "JSON repair failed on Gemini output");
          throw new AIInferenceError("Could not parse or repair Gemini JSON output", { rawText });
        }
      }

      const validated = schema.safeParse(parsedJson);

      if (!validated.success) {
        logger.error({ errors: validated.error.issues, parsedJson }, "Zod schema validation failed for Gemini output");
        throw new AIInferenceError("Gemini output failed schema validation", {
          issues: validated.error.issues,
        });
      }

      return validated.data;
    } catch (error) {
      logger.error({ error, prompt: prompt.substring(0, 100) }, "Structured extraction failure on Gemini");
      throw error instanceof AIInferenceError
        ? error
        : new AIInferenceError("Unexpected error during structured entity extraction via Gemini", {
            originalError: error instanceof Error ? error.message : String(error),
          });
    }
  }

  /**
   * Searches the web on-demand using duck-duck-scrape
   */
  async searchWeb(query: string, maxResults: number = 4): Promise<SearchResultDTO[]> {
    try {
      const { search, SafeSearchType } = await import("duck-duck-scrape");

      const searchResults = await search(query, {
        safeSearch: SafeSearchType.MODERATE,
      });

      if (!searchResults.results || searchResults.results.length === 0) {
        return [];
      }

      return searchResults.results.slice(0, maxResults).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.description,
      }));
    } catch (error) {
      logger.warn({ error, query }, "Web search query failed; returning empty results");
      return [];
    }
  }

  /**
   * Health check to detect if Google Gemini API key is valid and responsive
   */
  async healthCheck(): Promise<{ ok: boolean; modelLoaded: boolean; latencyMs: number; activeInRam?: boolean }> {
    const startTime = Date.now();
    try {
      this.ensureApiKey();
      const response = await fetch(`${this.baseUrl}/models?key=${this.apiKey}`, {
        method: "GET",
        signal: AbortSignal.timeout(6000),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return { ok: false, modelLoaded: false, activeInRam: false, latencyMs };
      }

      return {
        ok: true,
        modelLoaded: true,
        activeInRam: true,
        latencyMs,
      };
    } catch {
      return { ok: false, modelLoaded: false, activeInRam: false, latencyMs: Date.now() - startTime };
    }
  }
}

