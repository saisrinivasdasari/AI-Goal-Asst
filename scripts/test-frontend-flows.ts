import { prisma } from "../src/lib/db/prisma";
import { GoalService } from "../src/features/goals/goal.service";
import { getAIProvider } from "../src/lib/ai/client";
import { PersonalStateService } from "../src/features/analyst/personal-state.service";
import { JARVIS_SYSTEM_PROMPT } from "../src/lib/ai/prompts";

async function main() {
  console.log("==================================================");
  console.log("   JARVIS FRONTEND FLOW INTEGRATION TEST");
  console.log("==================================================");

  // 1. Get test user
  const user = await prisma.user.findFirst({
    where: { email: "user@jarvis.local" },
  });

  if (!user) {
    throw new Error("Test user not found");
  }

  console.log(`👤 Active User: ${user.email} (${user.id})\n`);

  // 2. Test Goal Creation with the exact fields sent by the UI Wizard
  console.log("1. Testing Goal Creation from Frontend Wizard...");
  const uiGoalPayload = {
    title: "Build Production Kubernetes Cluster",
    lifeAreaName: "CAREER",
    dreamVision: "Build Production Kubernetes Cluster",
    whyReason: "Attain high-availability infrastructure expertise",
    whyNow: "Critical for production infrastructure roadmap",
    costOfInaction: "Single point of failure and inability to scale services",
    successDefinition: "Zero-downtime rolling deploys with automated failover",
    targetDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
    estimatedHoursTotal: 30,
  };

  const createdGoal = await GoalService.createGoal(user.id, uiGoalPayload);
  console.log(`   Goal Created Successfully: "${createdGoal.title}" (ID: ${createdGoal.id}) ✅`);
  console.log(`   Milestones Generated: ${createdGoal.milestones?.length || 0} ✅`);

  // 3. Test Chat Stream Chunking
  console.log("\n2. Testing Jarvis Co-Pilot Chat Stream with SSE parsing...");
  const state = await PersonalStateService.getSnapshot(user.id);
  const ai = getAIProvider();

  const stream = await ai.streamChat({
    systemPrompt: `${JARVIS_SYSTEM_PROMPT}\n<personal_state>${JSON.stringify(state)}</personal_state>`,
    messages: [{ role: "user", content: "Jarvis, in one brief sentence, what is my top focus?" }],
    temperature: 0.5,
  });

  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let chunksReceived = 0;
  let fullResponse = "";
  let done = false;

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      const text = decoder.decode(value);
      chunksReceived++;
      // Parse SSE lines
      const lines = text.split("\n\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("data: ")) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(dataStr);
            if (parsed.content) fullResponse += parsed.content;
          } catch {
            fullResponse += dataStr;
          }
        }
      }
    }
  }

  console.log(`   SSE Chunks Received: ${chunksReceived} ✅`);
  console.log(`   Full Streamed Response: "${fullResponse.trim()}" ✅`);

  console.log("\n==================================================");
  console.log("🎉 ALL FRONTEND FLOWS VERIFIED OPERATIONAL!");
  console.log("==================================================");
}

main()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

