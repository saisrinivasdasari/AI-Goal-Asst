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

export class OllamaProviderAdapter implements IAIProvider {
  private baseUrl: string;
  private chatModel: string;
  private embeddingModel: string;
  private numCtx: number;
  private keepAlive: string;

  constructor() {
    this.baseUrl = (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
    this.chatModel = process.env.DEFAULT_CHAT_MODEL || "qwen3:4b";
    this.embeddingModel = process.env.DEFAULT_EMBEDDING_MODEL || "nomic-embed-text";
    this.numCtx = parseInt(process.env.OLLAMA_NUM_CTX || "4096", 10);
    this.keepAlive = process.env.OLLAMA_KEEP_ALIVE || "30m";
  }

  /**
   * Streams chat responses via Ollama /api/chat as a ReadableStream
   * Supports immediate TTFT via </think> priming, keeping models warm in RAM,
   * and emitting performance telemetry metrics on completion.
   */
  async streamChat(options: ChatStreamOptions): Promise<ReadableStream<Uint8Array>> {
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    const messages: ChatMessageDTO[] = [];

    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    messages.push(...options.messages);

    // If disableThinking is not explicitly false, prime the assistant message past the <think> tag
    // to bypass the 500-1500 reasoning token cycle and achieve instant ~1s TTFT on Qwen3
    const shouldDisableThinking = options.disableThinking !== false;
    const lastMsg = messages[messages.length - 1];
    if (shouldDisableThinking && lastMsg && lastMsg.role === "user") {
      messages.push({ role: "assistant", content: "</think>\n" });
    }

    const payload = {
      model: this.chatModel,
      messages,
      stream: true,
      keep_alive: options.keepAlive ?? this.keepAlive,
      options: {
        temperature: options.temperature ?? 0.7,
        num_ctx: options.numCtx ?? this.numCtx,
        num_predict: options.maxTokens ?? 384,
        stop: ["<|im_end|>", "<|im_start|>"],
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        throw new AIInferenceError(
          `Ollama chat request failed with status: ${response.status}`,
          { status: response.status }
        );
      }

      const decoder = new TextDecoder("utf-8");
      const encoder = new TextEncoder();
      let buffer = "";

      const transformStream = new TransformStream<Uint8Array, Uint8Array>({
        start(controller) {
          // Immediately flush initial SSE preamble so HTTP headers are committed instantly to client
          controller.enqueue(encoder.encode(": connected\n\n"));
        },
        transform(chunk, controller) {
          buffer += decoder.decode(chunk, { stream: true });
          const lines = buffer.split("\n");
          // Keep trailing incomplete fragment in buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            try {
              const parsed = JSON.parse(trimmed);
              const content = parsed.message?.content || "";
              const thinking = parsed.message?.thinking || "";

              if (content.length > 0) {
                if (firstTokenTime === null) {
                  firstTokenTime = Date.now();
                }
                // Emit both content format and typed format for backward compatibility
                const sseData = `data: ${JSON.stringify({ type: "content", content })}\n\n`;
                controller.enqueue(encoder.encode(sseData));
              } else if (thinking.length > 0 && !shouldDisableThinking) {
                const sseData = `data: ${JSON.stringify({ type: "thinking", content: thinking })}\n\n`;
                controller.enqueue(encoder.encode(sseData));
              }

              if (parsed.done) {
                const ttftMs = firstTokenTime ? firstTokenTime - startTime : undefined;
                const totalDurationMs = Date.now() - startTime;
                const evalCount = parsed.eval_count || 0;
                const evalDurationSec = (parsed.eval_duration || 0) / 1e9;
                const tokensPerSecond =
                  evalDurationSec > 0 ? Number((evalCount / evalDurationSec).toFixed(1)) : undefined;
                const loadDurationMs = parsed.load_duration
                  ? Math.round(parsed.load_duration / 1e6)
                  : undefined;
                const promptEvalDurationMs = parsed.prompt_eval_duration
                  ? Math.round(parsed.prompt_eval_duration / 1e6)
                  : undefined;

                const metricsPayload = {
                  type: "metrics",
                  metrics: {
                    ttftMs,
                    totalDurationMs,
                    evalCount,
                    tokensPerSecond,
                    loadDurationMs,
                    promptEvalDurationMs,
                  },
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(metricsPayload)}\n\n`));
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              }
            } catch {
              // Ignore partial JSON lines
            }
          }
        },
        flush(controller) {
          if (buffer.trim().length > 0) {
            try {
              const parsed = JSON.parse(buffer.trim());
              const content = parsed.message?.content || "";
              if (content.length > 0) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content", content })}\n\n`));
              }
            } catch {
              // Ignore
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        },
      });

      return response.body.pipeThrough(transformStream);
    } catch (error) {
      logger.error({ error }, "Error connecting to Ollama streaming chat");
      throw new AIInferenceError("Failed to communicate with local AI inference engine", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Generates a 768-dimensional dense vector using nomic-embed-text.
   * Prepends asymmetric prefixes: "search_document: " for storage, "search_query: " for queries.
   */
  async embedText(text: string, mode: "document" | "query" = "document"): Promise<number[]> {
    const prefix = mode === "query" ? "search_query: " : "search_document: ";
    const prompt = `${prefix}${text.trim()}`;

    try {
      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.embeddingModel,
          prompt,
          keep_alive: this.keepAlive,
        }),
      });

      if (!response.ok) {
        throw new AIInferenceError(`Ollama embedding request failed: ${response.statusText}`, {
          status: response.status,
        });
      }

      const data = await response.json();
      if (!data.embedding || !Array.isArray(data.embedding)) {
        throw new AIInferenceError("Ollama did not return a valid embedding vector");
      }

      return data.embedding;
    } catch (error) {
      logger.error({ error, text: text.substring(0, 50) }, "Failed to generate text embedding");
      throw new AIInferenceError("Error computing embedding vector via Ollama", {
        originalError: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Extracts structured data with guaranteed Zod validation using deterministic temperature: 0.1
   * Optimizes latency by capping num_predict to 384, preventing duplicate JSON re-generation
   * with exact stop tokens, and pinning the model in RAM via keep_alive: "30m".
   */
  async generateStructured<T>(
    prompt: string,
    schema: ZodSchema<T>,
    temperature: number = 0.1
  ): Promise<T> {
    // Prime the assistant with "</think>\n{" to immediately bypass the reasoning token trace
    const payload = {
      model: this.chatModel,
      messages: [
        {
          role: "system",
          content:
            "You are a strict data extraction engine. Output ONLY valid, raw JSON conforming to the requested schema. Do not include markdown codeblocks (no ```json). No conversational filler.",
        },
        {
          role: "user",
          content: prompt,
        },
        {
          role: "assistant",
          content: "</think>\n{",
        },
      ],
      stream: false,
      keep_alive: this.keepAlive,
      options: {
        temperature,
        num_ctx: this.numCtx,
        num_predict: 384,
        stop: ["</think>", "\n</think>", "<|im_end|>", "<|im_start|>"],
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(90000), // 90-second resilience window
      });

      if (!response.ok) {
        throw new AIInferenceError(`Ollama structured extraction failed: ${response.status}`);
      }

      const data = await response.json();
      let rawText = (data.message?.content || "").trim();

      // Reconstruct leading brace since assistant primed "{"
      if (!rawText.startsWith("{")) {
        rawText = "{" + rawText;
      }

      // Extract complete outermost JSON object (from first { to last })
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
          logger.error({ repairErr, rawText }, "JSON repair failed on model output");
          throw new AIInferenceError("Could not parse or repair model JSON output", { rawText });
        }
      }

      const validated = schema.safeParse(parsedJson);

      if (!validated.success) {
        logger.error({ errors: validated.error.issues, parsedJson }, "Zod schema validation failed");
        throw new AIInferenceError("Model output failed schema validation", {
          issues: validated.error.issues,
        });
      }

      return validated.data;
    } catch (error) {
      logger.error({ error, prompt: prompt.substring(0, 100) }, "Structured extraction failure");
      throw error instanceof AIInferenceError
        ? error
        : new AIInferenceError("Unexpected error during structured entity extraction", {
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
   * Health check to detect if local/remote Ollama instance is responsive and warm in RAM
   */
  async healthCheck(): Promise<{ ok: boolean; modelLoaded: boolean; latencyMs: number; activeInRam?: boolean }> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        return { ok: false, modelLoaded: false, activeInRam: false, latencyMs };
      }

      const data = await response.json();
      const models: string[] = (data.models || []).map((m: { name: string }) => m.name);

      const hasChat = models.some((m) => m.startsWith(this.chatModel.split(":")[0]));
      const hasEmbed = models.some((m) => m.startsWith(this.embeddingModel.split(":")[0]));

      // Check if chat model is warm in RAM via /api/ps
      let activeInRam = false;
      try {
        const psResp = await fetch(`${this.baseUrl}/api/ps`, { signal: AbortSignal.timeout(2000) });
        if (psResp.ok) {
          const psData = await psResp.json();
          activeInRam = (psData.models || []).some((m: { name: string }) =>
            m.name.startsWith(this.chatModel.split(":")[0])
          );
        }
      } catch {
        // ignore
      }

      return {
        ok: true,
        modelLoaded: hasChat && hasEmbed,
        activeInRam,
        latencyMs,
      };
    } catch {
      return { ok: false, modelLoaded: false, activeInRam: false, latencyMs: Date.now() - startTime };
    }
  }
}

