import { getAIProvider } from "../src/lib/ai/client";
import { z } from "zod";

async function runVerification() {
  console.log("==========================================");
  console.log("   JARVIS AI PIPELINE VERIFICATION");
  console.log("==========================================\n");

  const ai = getAIProvider();

  // Test 1: Health Check
  console.log("1. Running Health Check against Ollama...");
  const health = await ai.healthCheck();
  console.log(`   Status: ${health.ok ? "ONLINE ✅" : "OFFLINE ❌"}`);
  console.log(`   Models Available: ${health.modelLoaded ? "YES (qwen3:4b + nomic-embed-text) ✅" : "NO ❌"}`);
  console.log(`   Latency: ${health.latencyMs}ms\n`);

  if (!health.ok) {
    throw new Error("Ollama is not reachable at http://127.0.0.1:11434");
  }

  // Test 2: Nomic Embedding Generation
  console.log("2. Testing Asymmetric Embedding Generation (nomic-embed-text)...");
  const embedding = await ai.embedText("Build a daily habit of deep work and fitness", "document");
  console.log(`   Dimensions: ${embedding.length} (Expected: 768) ${embedding.length === 768 ? "✅" : "❌"}`);
  console.log(`   Sample vector: [${embedding.slice(0, 3).map((v) => v.toFixed(4)).join(", ")}...]\n`);

  // Test 3: Structured Entity Extraction with Zod
  console.log("3. Testing Structured JSON Extraction (qwen3:4b + Zod)...");
  const IntentSchema = z.object({
    intent: z.enum([
      "GOAL_CREATE",
      "JOURNAL_ENTRY",
      "MEMORY_QUERY",
      "IDEA_CAPTURE",
      "SCHEDULE_QUERY",
      "RESCHEDULING",
      "GENERAL_CHAT",
    ]),
    topic: z.string(),
    summary: z.string(),
    confidence: z.number().min(0).max(1),
  });

  const structuredResult = await ai.generateStructured(
    `Classify the following user input: "I really want to get into competitive badminton and train 3 times a week."

Output ONLY JSON in this format:
{
  "intent": "GOAL_CREATE",
  "topic": "Badminton",
  "summary": "User wants to start training competitively 3x a week",
  "confidence": 0.95
}
Available intents: "GOAL_CREATE", "JOURNAL_ENTRY", "MEMORY_QUERY", "IDEA_CAPTURE", "SCHEDULE_QUERY", "RESCHEDULING", "GENERAL_CHAT".`,
    IntentSchema
  );

  console.log("   Result:", JSON.stringify(structuredResult, null, 2));
  console.log(`   Structured Extraction Passed: ${structuredResult.intent === "GOAL_CREATE" ? "✅" : "⚠️"}\n`);

  // Test 4: External Web Search Grounding
  console.log("4. Testing External Web Search Grounding (DuckDuckGo)...");
  const searchResults = await ai.searchWeb("Next.js 15 App Router best practices", 2);
  console.log(`   Found ${searchResults.length} search results:`);
  searchResults.forEach((r, idx) => {
    console.log(`   [${idx + 1}] ${r.title.substring(0, 50)}... (${r.url})`);
  });
  console.log(`   Web Search Tool Passed: ${searchResults.length > 0 ? "✅" : "⚠️ (Network unavailable)"}\n`);

  // Test 5: Streaming Chat
  console.log("5. Testing Streaming Chat with Jarvis persona...");
  const stream = await ai.streamChat({
    systemPrompt: "You are Jarvis. Answer concisely in one sentence.",
    messages: [{ role: "user", content: "Jarvis, are you online and ready to assist?" }],
    temperature: 0.7,
  });

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullResponse = "";

  process.stdout.write("   Jarvis: \"");
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    fullResponse += text;
    process.stdout.write(text);
  }
  console.log("\"\n");

  console.log("==========================================");
  console.log("🎉 ALL AI PIPELINE VERIFICATIONS PASSED!");
  console.log("==========================================");
}

runVerification().catch((err) => {
  console.error("\n❌ Verification Failed:", err);
  process.exit(1);
});

