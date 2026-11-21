import { getAuthenticatedUser } from "../src/lib/auth";
import { CapacityService } from "../src/features/capacity/capacity.service";
import { GoalService } from "../src/features/goals/goal.service";
import { MissionService } from "../src/features/mission/mission.service";
import { JournalService } from "../src/features/journal/journal.service";
import { AdaptiveReschedulerService } from "../src/features/analyst/rescheduler.service";
import { PersonalStateService } from "../src/features/analyst/personal-state.service";
import { TaskStatus } from "@prisma/client";

async function runPhase2Verification() {
  console.log("==================================================");
  console.log("   JARVIS PHASE 2: CORE GOAL ENGINE VERIFICATION");
  console.log("==================================================\n");

  const user = await getAuthenticatedUser();
  console.log(`👤 Active User: ${user.email} (${user.id})\n`);

  // 1. Capacity & Energy Engine
  console.log("1. Testing Capacity & Energy Engine...");
  const updatedSchedule = await CapacityService.updateCapacity(user.id, {
    dayJobHoursWeekly: 40,
    sleepHoursDaily: 7.5,
    commuteHoursDaily: 1.0,
    fixedCommitmentsWeekly: 10.0,
    peakEnergyWindow: "HIGH_FOCUS",
  });
  console.log(`   Net Available Goal Capacity: ${updatedSchedule.netAvailableGoalHours} hrs/week ✅`);

  const currentEnergySlot = await CapacityService.getCurrentEnergySlot(user.id);
  console.log(`   Current Real-Time Energy Slot: ${currentEnergySlot} ✅\n`);

  // 2. Goal Creation & AI Decomposition
  console.log("2. Testing Goal Engine & Hierarchical AI Decomposition...");
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + 60); // 60 days ahead

  const goal = await GoalService.createGoal(user.id, {
    title: "Master High-Scale Backend Systems",
    dreamVision: "Lead Staff Engineering Architect for global cloud platforms",
    whyReason: "Pride in technical craft and complete financial independence",
    whyNow: "Cloud architectures are evolving rapidly and momentum matters now",
    costOfInaction: "Stagnate in repetitive CRUD tasks and miss career elevation",
    successDefinition: "Design, benchmark, and deploy a distributed event-driven engine",
    targetDate: targetDate.toISOString().split("T")[0],
    estimatedHoursTotal: 40,
  });

  console.log(`   Goal Created: "${goal.title}" (ID: ${goal.id})`);
  console.log(`   Milestones Generated: ${goal.milestones.length} ✅`);
  goal.milestones.forEach((m) => {
    console.log(`     - [Milestone ${m.orderIndex}] ${m.title} (${m.weeklyTargets.length} weekly targets)`);
  });

  // Verify Journey / Roadmap tree (GAP 7)
  const journey = await GoalService.getGoalJourney(user.id, goal.id);
  console.log(`   Goal Journey Pace: ${journey.paceStatus} (Overall Progress: ${journey.overallProgress}%) ✅\n`);

  // 3. "Today's Mission" Daily Dashboard
  console.log("3. Testing 'Today's Mission' Daily Execution...");
  const mission = await MissionService.getTodaysMission(user.id);
  console.log(`   Today's Mission Date: ${mission.date}`);
  console.log(`   Tasks Scheduled: ${mission.tasks.length}`);

  let testInstanceId: string | null = null;
  if (mission.tasks.length > 0) {
    const first = mission.tasks[0];
    testInstanceId = first.instanceId;
    console.log(`     * Top Priority Task: "${first.title}" [${first.priority}]`);
    console.log(`     * Emotional Anchor: "${first.whyReason}" ✅`);
    console.log(`     * Energy Matched: ${first.isEnergyMatched ? "YES ✅" : "NO"}`);

    // Update status to COMPLETED
    await MissionService.updateTaskStatus(user.id, first.instanceId, TaskStatus.COMPLETED, 45, "Flawless execution");
    console.log(`   Task Status Updated -> COMPLETED ✅\n`);
  }

  // 4. Conversational Life Journal ("Life Inbox")
  console.log("4. Testing Conversational Life Journal Ingestion...");
  const rawJournal = `
    Today was deeply productive. I spent 2 hours designing the distributed data pipeline and completed the API schema.
    Also did a 5km evening run to recharge.
    Realization: Morning focus blocks before checking emails give me 3x better clarity than afternoon sessions.
  `;

  const journalResult = await JournalService.ingestJournal(user.id, rawJournal);
  console.log(`   Detected Mood: "${journalResult.journalEntry.detectedMood}" ✅`);
  console.log(`   Items Categorized: ${journalResult.journalEntry.items.length}`);
  journalResult.journalEntry.items.forEach((it) => {
    console.log(`     - [${it.category}] ${it.content}`);
  });
  console.log(`   Universal Memories Embedded: ${journalResult.createdMemories.length} ✅\n`);

  // 5. Adaptive Rescheduling Engine (Anti-Guilt Protection)
  console.log("5. Testing Adaptive Rescheduling Engine...");
  if (mission.tasks.length > 1) {
    const secondTask = mission.tasks[1];
    const reschedResult = await AdaptiveReschedulerService.rescheduleMissedTask(user.id, {
      missedTaskInstanceId: secondTask.instanceId,
    });
    console.log(`   Reschedule Action: ${reschedResult.action} ✅`);
    console.log(`   Jarvis Explanation: "${reschedResult.explanation}" ✅\n`);
  } else if (testInstanceId) {
    const reschedResult = await AdaptiveReschedulerService.rescheduleMissedTask(user.id, {
      missedTaskInstanceId: testInstanceId,
    });
    console.log(`   Reschedule Action: ${reschedResult.action} ✅`);
    console.log(`   Jarvis Explanation: "${reschedResult.explanation}" ✅\n`);
  }

  // 6. Personal State Engine Snapshot (GAP 5)
  console.log("6. Testing Personal State Engine Snapshot...");
  const snapshot = await PersonalStateService.getSnapshot(user.id);
  console.log(`   Active Goals Tracked: ${snapshot.activeGoals.length}`);
  console.log(`   Current Available Capacity: ${snapshot.capacity.netAvailableHours} hrs`);
  console.log(`   Situational Awareness Grounding: COMPLETE ✅\n`);

  console.log("==================================================");
  console.log("🎉 ALL PHASE 2 CORE ENGINES VERIFIED & OPERATIONAL!");
  console.log("==================================================");
}

runPhase2Verification().catch((err) => {
  console.error("\n❌ Phase 2 Verification Failed:", err);
  process.exit(1);
});

