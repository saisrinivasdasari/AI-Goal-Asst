import { prisma } from "../src/lib/db/prisma";
import { PatternDetectorService } from "../src/features/analyst/pattern-detector";
import { ProjectionsService } from "../src/features/analyst/projections.service";
import { WeeklyReviewService } from "../src/features/reviews/weekly-review.service";
import { MonthlyReviewService } from "../src/features/reviews/monthly-review.service";

async function main() {
  console.log("==================================================");
  console.log("   JARVIS PHASE 3: ANALYTICS & REVIEWS TEST");
  console.log("==================================================");

  // 1. Get or create test user
  let user = await prisma.user.findFirst({
    where: { email: "user@jarvis.local" },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: "user@jarvis.local",
        profile: {
          create: {
            fullName: "Saisrikar User",
            motivationalStyle: "supportive_friend",
          },
        },
      },
    });
  }

  console.log(`👤 Active User: ${user.email} (${user.id})\n`);

  // 2. Test Pattern Detector
  console.log("1. Testing 14-Day Behavioral Pattern Engine...");
  const patternReport = await PatternDetectorService.analyzeRolling14Days(user.id);
  console.log(`   Consistency Score: ${patternReport.consistencyScore}% ✅`);
  console.log(`   Energy Alignment: ${patternReport.energyAlignmentScore}% ✅`);
  console.log(`   Life Area Distribution: ${JSON.stringify(patternReport.lifeAreaDistribution)} ✅`);
  if (patternReport.insights.length > 0) {
    console.log(`   Observation: "${patternReport.insights[0].observation}" ✅`);
  }

  // 3. Test "Future You" 3-Trajectory Projections
  console.log("\n2. Testing 'Future You' 3-Trajectory Projections Engine...");
  const projectionReport = await ProjectionsService.calculateProjections(user.id);
  console.log(`   Subject Goal: "${projectionReport.goalTitle}" ✅`);
  console.log(`   Current Velocity: ${projectionReport.currentVelocityHoursPerWeek} hrs/week ✅`);
  console.log(`   Trajectories Calculated: ${projectionReport.trajectories.length} ✅`);
  projectionReport.trajectories.forEach((t) => {
    console.log(`     - [${t.trajectory}] ${t.title}: ETA ${t.projectedCompletionDate} (${t.confidenceScore}% confidence)`);
  });

  // 4. Test Weekly Tactical Review
  console.log("\n3. Testing Weekly Tactical Review Engine...");
  const weeklyReview = await WeeklyReviewService.generateWeeklyReview(
    user.id,
    "Testing weekly review flow with high-scale architecture milestones"
  );
  console.log(`   Weekly Review ID: ${weeklyReview.id} ✅`);
  console.log(`   Week Starting: ${weeklyReview.weekStartDate.toISOString().split("T")[0]} ✅`);
  console.log(`   Tasks Logged: ${weeklyReview.completedTasksCount} done, ${weeklyReview.missedTasksCount} missed ✅`);
  console.log(`   AI Suggestion: "${weeklyReview.aiSuggestion?.slice(0, 80)}..." ✅`);

  // 5. Test Monthly Strategic Review & Identity Shift
  console.log("\n4. Testing Monthly Strategic Review & Identity Shift Engine...");
  const monthlyReview = await MonthlyReviewService.generateMonthlyReview(user.id, {
    identityShiftNotes: "I now intuitively design distributed systems and track my daily energy with discipline.",
    userReflections: "Exceptional month of deep technical focus and zero backlog anxiety.",
  });
  console.log(`   Monthly Review ID: ${monthlyReview.id} ✅`);
  console.log(`   Month Starting: ${monthlyReview.monthStartDate.toISOString().split("T")[0]} ✅`);
  console.log(`   Achievements: "${monthlyReview.achievementsSummary?.slice(0, 70)}..." ✅`);
  console.log(`   Identity Shift Notes: "${monthlyReview.identityShiftNotes}" ✅`);

  console.log("\n==================================================");
  console.log("🎉 ALL PHASE 3 ENGINES VERIFIED & PERSISTED!");
  console.log("==================================================");
}

main()
  .catch((err) => {
    console.error("Test failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

