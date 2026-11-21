import { IAIProvider } from "./types";
import { OllamaProviderAdapter } from "./ollama-adapter";
import { GeminiProviderAdapter } from "./gemini-adapter";

let aiProviderInstance: IAIProvider | null = null;

/**
 * Returns the singleton AI Provider instance.
 * Allows transparent swapping of local Ollama, remote server, or cloud models
 * with ZERO business logic changes across the entire application.
 */
export function getAIProvider(): IAIProvider {
  if (!aiProviderInstance) {
    const configuredProvider = process.env.AI_PROVIDER?.toLowerCase();
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

    if (configuredProvider === "gemini" || (hasGeminiKey && configuredProvider !== "ollama")) {
      aiProviderInstance = new GeminiProviderAdapter();
    } else {
      aiProviderInstance = new OllamaProviderAdapter();
    }
  }
  return aiProviderInstance;
}

/**
 * Resets the cached AI provider instance. Useful during test suites or dynamic re-configuration.
 */
export function resetAIProvider(): void {
  aiProviderInstance = null;
}
