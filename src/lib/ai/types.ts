import { ZodSchema } from "zod";

export interface ChatMessageDTO {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface SearchResultDTO {
  title: string;
  url: string;
  snippet: string;
}

export interface AIResponseMetrics {
  ttftMs?: number;
  totalDurationMs?: number;
  evalCount?: number;
  tokensPerSecond?: number;
  loadDurationMs?: number;
  promptEvalDurationMs?: number;
}

export interface ChatStreamOptions {
  messages: ChatMessageDTO[];
  temperature?: number;
  maxTokens?: number;
  numCtx?: number; // Configurable context window (default: 4096 tokens)
  systemPrompt?: string;
  enableWebSearch?: boolean; // When true, model may call searchWeb
  disableThinking?: boolean; // Bypass Qwen3 deep thinking tokens for ultra-fast TTFT
  keepAlive?: string; // Keep model loaded in memory (default: "30m")
}

export interface IAIProvider {
  /**
   * Returns a streaming readable stream compatible with Next.js Response / SSE
   */
  streamChat(options: ChatStreamOptions): Promise<ReadableStream<Uint8Array>>;

  /**
   * Generates a 768-dimensional dense vector for semantic search.
   * Automatically applies 'search_document: ' or 'search_query: ' prefix for nomic-embed-text.
   */
  embedText(text: string, mode?: "document" | "query"): Promise<number[]>;

  /**
   * Structured entity extraction with guaranteed Zod schema enforcement
   */
  generateStructured<T>(prompt: string, schema: ZodSchema<T>, temperature?: number): Promise<T>;

  /**
   * On-demand web search tool for external knowledge grounding
   */
  searchWeb(query: string, maxResults?: number): Promise<SearchResultDTO[]>;

  /**
   * Health check to detect if local/remote Ollama instance is responsive
   */
  healthCheck(): Promise<{ ok: boolean; modelLoaded: boolean; latencyMs: number; activeInRam?: boolean }>;
}

