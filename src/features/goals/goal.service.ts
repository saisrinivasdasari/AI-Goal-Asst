import { prisma } from "@/lib/db/prisma";
import { getAIProvider } from "@/lib/ai/client";
import { CapacityExceededError, NotFoundError, ValidationError } from "@/lib/errors";
import { z } from "zod";
import { PriorityLevel, EnergyLevel, TaskStatus } from "@prisma/client";

export interface CreateGoalDTO {
  title: string;
  lifeAreaName?: string;
  dreamVision: string;
  whyReason: string;
  whyNow: string;
  costOfInaction: string;
  successDefinition: string;
  targetDate: string; // ISO date string
  estimatedHoursTotal: number;
}

const FlexibleEnergyLevelSchema = z.preprocess((val) => {
  if (typeof val !== "string") return "HIGH_FOCUS";
  const upper = val.toUpperCase().trim();
  if (upper.includes("HIGH")) return "HIGH_FOCUS";
  if (upper.includes("LOW") || upper.includes("REC")) return "LOW_RECOVERY";
  return "MEDIUM";
}, z.enum(["HIGH_FOCUS", "MEDIUM", "LOW_RECOVERY"]).default("HIGH_FOCUS"));

const FlexiblePriorityLevelSchema = z.preprocess((val) => {
  if (typeof val !== "string") return "P1_IMPORTANT";
  const upper = val.toUpperCase().trim();
  if (upper.includes("0") || upper.includes("CRIT") || upper.includes("HIGH")) return "P0_CRITICAL";
  if (upper.includes("2") || upper.includes("OPT") || upper.includes("LOW")) return "P2_OPTIONAL";
  return "P1_IMPORTANT";
}, z.enum(["P0_CRITICAL", "P1_IMPORTANT", "P2_OPTIONAL"]).default("P1_IMPORTANT"));

const AI_GOAL_BREAKDOWN_SCHEMA = z.object({
  milestones: z.array(
    z.object({
      title: z.string(),
      description: z.string().optional().default("Milestone phase"),
      orderIndex: z.number().default(1),
      estimatedWeeksFromStart: z.number().default(2),
      weeklyTargets: z.array(
        z.object({
          title: z.string(),
          targetHours: z.number().default(5),
          tasks: z.array(
            z.object({
              title: z.string(),
              description: z.string().optional().default(""),
              priority: FlexiblePriorityLevelSchema,
              estimatedMinutes: z.number().default(60),
              requiredEnergy: FlexibleEnergyLevelSchema,
            })
          ).min(1),
        })
      ).min(1),
    })
  ).min(1),
});

export interface PreviewRoadmapInput {
  title: string;
  category?: string;
  durationWeeks: number; // e.g. 2, 4, 8, 12
  weeklyHours?: number;
  whyReason?: string;
  whyNow?: string;
  costOfInaction?: string;
  customRoadmapText?: string;
}

export interface ConfirmRoadmapInput {
  title: string;
  category?: string;
  lifeAreaName?: string;
  whyReason?: string;
  whyNow?: string;
  costOfInaction?: string;
  dreamVision?: string;
  successDefinition?: string;
  targetDate: string; // ISO string
  estimatedHoursTotal?: number;
  milestones: Array<{
    title: string;
    description?: string;
    orderIndex: number;
    estimatedWeeksFromStart: number;
    weeklyTargets: Array<{
      title: string;
      targetHours: number;
      tasks: Array<{
        title: string;
        description?: string;
        priority: "P0_CRITICAL" | "P1_IMPORTANT" | "P2_OPTIONAL";
        estimatedMinutes: number;
        requiredEnergy: "HIGH_FOCUS" | "MEDIUM" | "LOW_RECOVERY";
      }>;
    }>;
  }>;
}

export interface UpdateGoalDTO {
  title?: string;
  whyReason?: string;
  dreamVision?: string;
  category?: string;
  targetDate?: string;
  status?: string;
  milestones?: Array<{
    id?: string;
    title: string;
    targetDate?: string;
    orderIndex?: number;
    weeklyTargets?: Array<{
      id?: string;
      title: string;
      targetHours?: number;
      tasks?: Array<{
        id?: string;
        title: string;
        description?: string;
        priority?: "P0_CRITICAL" | "P1_IMPORTANT" | "P2_OPTIONAL";
        estimatedMinutes?: number;
        requiredEnergy?: "HIGH_FOCUS" | "MEDIUM" | "LOW_RECOVERY";
      }>;
    }>;
  }>;
}

export class GoalService {
  /**
   * Creates a goal, verifies capacity constraints, and generates an AI breakdown
   */
  static async createGoal(userId: string, input: CreateGoalDTO) {
    const targetDate = new Date(input.targetDate);
    const now = new Date();

    if (targetDate <= now) {
      throw new ValidationError("Target completion date must be in the future.");
    }

    const diffDays = Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.max(1, Math.round(diffDays / 7));
    const requiredWeeklyHours = parseFloat((input.estimatedHoursTotal / diffWeeks).toFixed(1));

    // 1. Capacity Guard Verification
    const capacitySchedule = await prisma.capacitySchedule.findUnique({
      where: { userId },
    });

    const netAvailable = capacitySchedule?.netAvailableGoalHours ?? 15.0;

    // Check existing active goals to prevent total overload
    const activeGoals = await prisma.goal.findMany({
      where: { userId, status: "ACTIVE" },
      select: { estimatedHoursTotal: true, targetDate: true, createdAt: true },
    });

    let currentWeeklyLoad = 0;
    for (const g of activeGoals) {
      const gWeeks = Math.max(1, Math.ceil((g.targetDate.getTime() - g.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 7)));
      currentWeeklyLoad += g.estimatedHoursTotal / gWeeks;
    }

    if (currentWeeklyLoad + requiredWeeklyHours > netAvailable * 1.25) {
      throw new CapacityExceededError(
        `Adding this goal requires ~${requiredWeeklyHours} hrs/week, but your remaining available capacity is only ${(netAvailable - currentWeeklyLoad).toFixed(1)} hrs/week (Available: ${netAvailable} hrs, Committed: ${currentWeeklyLoad.toFixed(1)} hrs).`,
        {
          requiredWeeklyHours,
          netAvailableGoalHours: netAvailable,
          currentCommittedHours: currentWeeklyLoad,
        }
      );
    }

    // 2. Resolve Life Area
    let lifeArea = null;
    if (input.lifeAreaName) {
      lifeArea = await prisma.lifeArea.findFirst({
        where: { userId, name: { contains: input.lifeAreaName, mode: "insensitive" } },
      });
    }

    if (!lifeArea) {
      lifeArea = await prisma.lifeArea.findFirst({
        where: { userId },
      });
    }

    if (!lifeArea) {
      lifeArea = await prisma.lifeArea.create({
        data: {
          userId,
          name: "Personal Growth",
          icon: "compass",
          color: "#3b82f6",
        },
      });
    }

    // 3. AI Hierarchical Decomposition with Resilient Timeout Fallback
    const ai = getAIProvider();
    const prompt = `Break down goal "${input.title}" into 2 milestones JSON:
{
  "milestones": [
    {
      "title": "Foundational Setup",
      "description": "Establish fundamentals",
      "orderIndex": 1,
      "estimatedWeeksFromStart": 2,
      "weeklyTargets": [
        {
          "title": "Week 1 Setup",
          "targetHours": ${Math.min(requiredWeeklyHours, 10)},
          "tasks": [
            {
              "title": "Core architecture review",
              "priority": "P0_CRITICAL",
              "estimatedMinutes": 60,
              "requiredEnergy": "HIGH_FOCUS"
            }
          ]
        }
      ]
    }
  ]
}`;

    let aiBreakdown;
    try {
      aiBreakdown = await Promise.race([
        ai.generateStructured(prompt, AI_GOAL_BREAKDOWN_SCHEMA),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), 35000)),
      ]);
    } catch {
      // High-quality deterministic fallback breakdown ensuring instant resilience
      aiBreakdown = {
        milestones: [
          {
            title: "Phase 1: Foundation & Core Setup",
            description: `Establish core habits and initial systems for ${input.title}`,
            orderIndex: 1,
            estimatedWeeksFromStart: 2,
            weeklyTargets: [
              {
                title: "Week 1 Setup & Execution",
                targetHours: Math.min(requiredWeeklyHours, 10),
                tasks: [
                  {
                    title: `Initial setup and planning for ${input.title}`,
                    description: `Define foundational structure and environment for ${input.title}`,
                    priority: "P0_CRITICAL" as const,
                    estimatedMinutes: 60,
                    requiredEnergy: "HIGH_FOCUS" as const,
                  },
                  {
                    title: `Execute foundational practice`,
                    description: `Core deliberate practice session`,
                    priority: "P1_IMPORTANT" as const,
                    estimatedMinutes: 45,
                    requiredEnergy: "MEDIUM_FOCUS" as const,
                  },
                ],
              },
            ],
          },
          {
            title: "Phase 2: Deliberate Practice & Progress",
            description: `Deepen mastery and establish consistency in ${input.title}`,
            orderIndex: 2,
            estimatedWeeksFromStart: 4,
            weeklyTargets: [
              {
                title: "Week 2 Cadence",
                targetHours: Math.min(requiredWeeklyHours, 10),
                tasks: [
                  {
                    title: `Applied execution session`,
                    description: `Advanced practice and momentum building`,
                    priority: "P0_CRITICAL" as const,
                    estimatedMinutes: 45,
                    requiredEnergy: "HIGH_FOCUS" as const,
                  },
                ],
              },
            ],
          },
        ],
      };
    }

    if (!aiBreakdown || !aiBreakdown.milestones || aiBreakdown.milestones.length === 0) {
      aiBreakdown = {
        milestones: [
          {
            title: "Phase 1: Foundations",
            description: `Initial mastery track for ${input.title}`,
            orderIndex: 1,
            estimatedWeeksFromStart: 2,
            weeklyTargets: [
              {
                title: "Week 1 Core Focus",
                targetHours: Math.min(requiredWeeklyHours, 10),
                tasks: [
                  {
                    title: `Launch foundational practice for ${input.title}`,
                    description: `Kickoff session for ${input.title}`,
                    priority: "P0_CRITICAL" as const,
                    estimatedMinutes: 60,
                    requiredEnergy: "HIGH_FOCUS" as const,
                  },
                ],
              },
            ],
          },
        ],
      };
    }

    // 4. Atomic Transaction: Persist Goal, Milestones, Targets & First Week Tasks
    const goal = await prisma.$transaction(async (tx) => {
      const createdGoal = await tx.goal.create({
        data: {
          userId,
          lifeAreaId: lifeArea.id,
          title: input.title,
          dreamVision: input.dreamVision,
          whyReason: input.whyReason,
          whyNow: input.whyNow,
          costOfInaction: input.costOfInaction,
          successDefinition: input.successDefinition,
          targetDate,
          estimatedHoursTotal: input.estimatedHoursTotal,
          status: "ACTIVE",
        },
      });

      for (const m of aiBreakdown.milestones) {
        const milestoneTargetDate = new Date();
        milestoneTargetDate.setDate(milestoneTargetDate.getDate() + m.estimatedWeeksFromStart * 7);

        const milestone = await tx.goalMilestone.create({
          data: {
            goalId: createdGoal.id,
            title: m.title,
            orderIndex: m.orderIndex,
            targetDate: milestoneTargetDate,
          },
        });

        for (let wIdx = 0; wIdx < m.weeklyTargets.length; wIdx++) {
          const wt = m.weeklyTargets[wIdx];
          const currentWeekNum = Math.ceil(
            (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 7)
          );

          const weeklyTarget = await tx.weeklyTarget.create({
            data: {
              milestoneId: milestone.id,
              title: wt.title,
              weekNumber: currentWeekNum + wIdx,
              year: new Date().getFullYear(),
              targetHours: wt.targetHours,
            },
          });

          for (const t of wt.tasks) {
            const task = await tx.task.create({
              data: {
                weeklyTargetId: weeklyTarget.id,
                title: t.title,
                description: (t as any).description || t.title,
                priority: t.priority as PriorityLevel,
                estimatedMinutes: t.estimatedMinutes,
                requiredEnergy: t.requiredEnergy as EnergyLevel,
              },
            });

            // Automatically schedule an instance for tasks in the immediate milestone
            if (m.orderIndex === 1) {
              const now = new Date();
              const scheduledDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

              await tx.taskInstance.create({
                data: {
                  taskId: task.id,
                  scheduledDate,
                  status: TaskStatus.PENDING,
                },
              });
            }
          }
        }
      }

      return createdGoal;
    }, {
      maxWait: 10000,
      timeout: 25000,
    });

    return this.getGoal(userId, goal.id);
  }

  /**
   * Retrieves all goals with calculated progress
   */
  static async listGoals(userId: string, status?: string) {
    const goals = await prisma.goal.findMany({
      where: {
        userId,
        ...(status ? { status } : {}),
      },
      include: {
        lifeArea: true,
        milestones: {
          include: {
            weeklyTargets: {
              include: {
                tasks: {
                  include: {
                    instances: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return goals.map((goal) => {
      let totalTasks = 0;
      let completedTasks = 0;

      goal.milestones.forEach((m) => {
        m.weeklyTargets.forEach((wt) => {
          wt.tasks.forEach((t) => {
            totalTasks += t.instances.length;
            completedTasks += t.instances.filter((i) => i.status === TaskStatus.COMPLETED).length;
          });
        });
      });

      const progressPct = totalTasks > 0 ? parseFloat(((completedTasks / totalTasks) * 100).toFixed(1)) : 0.0;

      return {
        ...goal,
        progressPct,
        metrics: {
          totalTasks,
          completedTasks,
          milestonesCount: goal.milestones.length,
        },
      };
    });
  }

  /**
   * Retrieves full details for a specific goal
   */
  static async getGoal(userId: string, goalId: string) {
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId },
      include: {
        lifeArea: true,
        milestones: {
          orderBy: { orderIndex: "asc" },
          include: {
            weeklyTargets: {
              orderBy: { weekNumber: "asc" },
              include: {
                tasks: {
                  include: {
                    instances: {
                      orderBy: { scheduledDate: "asc" },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!goal) {
      throw new NotFoundError("Goal not found");
    }

    return goal;
  }

  /**
   * Retrieves Goal Journey tree with milestone ETA and pace status (GAP 7)
   */
  static async getGoalJourney(userId: string, goalId: string) {
    const goal = await this.getGoal(userId, goalId);

    const now = new Date();
    const totalDays = Math.max(1, (goal.targetDate.getTime() - goal.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const elapsedDays = Math.max(0, (now.getTime() - goal.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const timeProgressPct = Math.min(100, parseFloat(((elapsedDays / totalDays) * 100).toFixed(1)));

    let completedMilestones = 0;
    const roadmap = goal.milestones.map((m) => {
      let mTotal = 0;
      let mDone = 0;

      m.weeklyTargets.forEach((wt) => {
        wt.tasks.forEach((t) => {
          mTotal += t.instances.length;
          mDone += t.instances.filter((i) => i.status === TaskStatus.COMPLETED).length;
        });
      });

      const milestoneProgress = mTotal > 0 ? (mDone / mTotal) * 100 : 0;
      const isAchieved = milestoneProgress >= 100;
      if (isAchieved) completedMilestones++;

      return {
        id: m.id,
        title: m.title,
        orderIndex: m.orderIndex,
        targetDate: m.targetDate,
        progressPct: parseFloat(milestoneProgress.toFixed(1)),
        isAchieved,
        isCompleted: isAchieved,
        activeTargetsCount: m.weeklyTargets.length,
        weeklyTargets: m.weeklyTargets.map((wt) => ({
          id: wt.id,
          weekNumber: wt.weekNumber,
          title: wt.title,
          targetHours: wt.targetHours,
          isCompleted:
            wt.tasks.length > 0 &&
            wt.tasks.every(
              (t) =>
                t.instances.length > 0 &&
                t.instances.every((i) => i.status === TaskStatus.COMPLETED)
            ),
          tasks: wt.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            priority: t.priority,
            estimatedMinutes: t.estimatedMinutes,
            energyRequired: t.requiredEnergy,
            instances: t.instances,
            taskInstances: t.instances,
          })),
        })),
      };
    });

    const overallProgress =
      roadmap.length > 0 ? parseFloat((roadmap.reduce((acc, r) => acc + r.progressPct, 0) / roadmap.length).toFixed(1)) : 0;

    let paceStatus: "ON_TRACK" | "BEHIND_PACE" | "AHEAD_OF_PACE" = "ON_TRACK";
    if (overallProgress < timeProgressPct - 15) {
      paceStatus = "BEHIND_PACE";
    } else if (overallProgress > timeProgressPct + 10) {
      paceStatus = "AHEAD_OF_PACE";
    }

    return {
      goalId: goal.id,
      title: goal.title,
      dreamVision: goal.dreamVision,
      whyReason: goal.whyReason,
      category: goal.lifeArea?.name || "PERSONAL",
      targetDate: goal.targetDate,
      estimatedCompletionDate: goal.targetDate,
      timeProgressPct,
      overallProgress,
      overallProgressPercent: overallProgress,
      paceStatus,
      completedMilestones,
      totalMilestones: roadmap.length,
      milestones: roadmap,
    };
  }

  /**
   * Generates an in-memory preview roadmap tailored to flexible duration (1-16 weeks)
   * allowing the user to customize milestones before committing to the database.
   */
  static async previewRoadmapWithAI(userId: string, input: PreviewRoadmapInput) {
    const durationWeeks = Math.max(1, Math.min(input.durationWeeks || 4, 24));
    const weeklyHours = input.weeklyHours || 8;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + durationWeeks * 7);

    // Dynamic phase count based on horizon
    let numMilestones = 2;
    if (durationWeeks >= 8) numMilestones = 3;
    if (durationWeeks >= 14) numMilestones = 4;

    const ai = getAIProvider();
    const hasCustomSyllabus = Boolean(input.customRoadmapText && input.customRoadmapText.trim().length > 0);

    const prompt = hasCustomSyllabus
      ? `You are Jarvis, a master executive goal architect and elite curriculum compiler.
Decompose the goal "${input.title}" using the user's provided custom curriculum / syllabus / raw notes below into exactly ${numMilestones} progressive milestones spanning ${durationWeeks} weeks with a weekly commitment of ${weeklyHours} hours/week.
Each milestone must have 1 weekly target, and each weekly target must contain 3 to 4 concrete, bite-sized tasks (30 to 60 minutes each).

USER'S CUSTOM CURRICULUM / RAW ROADMAP:
"""
${input.customRoadmapText?.trim()}
"""

CRITICAL DIRECTIVES:
- FAITHFULLY PARSE AND MAP the user's topics, chapters, and bullet points into milestone phases and tasks. Respect their subject matter and progression.
- Do NOT output generic filler tasks like "Complete foundational study for [Goal]". Convert each topic into an actionable daily mission (e.g. "Implement B-Tree indexing in PostgreSQL", "Build OAuth2 JWT middleware in Express", "Solve 3 graph traversal BFS problems").
- If the user's custom text has fewer topics than needed, intelligently infer logical, hands-on practice or review tasks that directly reinforce their topics.
- If the user's custom text has more topics than can fit, group them strategically into the ${numMilestones} milestones based on chronological priority.
- Each task must produce a tangible, verifiable daily outcome.
- requiredEnergy must be one of: "HIGH_FOCUS", "MEDIUM", "LOW_RECOVERY".
- priority must be one of: "P0_CRITICAL", "P1_IMPORTANT", "P2_OPTIONAL".

Return strictly valid JSON matching:
{
  "milestones": [
    {
      "title": "Specific phase title derived from syllabus",
      "description": "Strategic milestone outcome",
      "orderIndex": 1,
      "estimatedWeeksFromStart": 1,
      "weeklyTargets": [
        {
          "title": "Focused weekly objective",
          "targetHours": ${weeklyHours},
          "tasks": [
            {
              "title": "Actionable task from user's syllabus",
              "description": "Tangible output or learning goal",
              "priority": "P0_CRITICAL",
              "estimatedMinutes": 45,
              "requiredEnergy": "HIGH_FOCUS"
            }
          ]
        }
      ]
    }
  ]
}`
      : `You are Jarvis, a master executive goal architect and elite mentor.
Decompose the goal "${input.title}" with a target duration of ${durationWeeks} weeks and a weekly commitment of ${weeklyHours} hours/week into exactly ${numMilestones} progressive milestones.
Each milestone must have 1 weekly target, and each weekly target must contain 3 to 4 concrete, bite-sized tasks (30 to 60 minutes each).

CRITICAL DIRECTIVES:
- Do NOT generate generic placeholder text (e.g. NEVER output "Setup environment and define scope for [Goal]" or "Complete foundational study for [Goal]").
- Generate highly practical, domain-specific tasks tailored directly to "${input.title}". For example, for technical interview preparation, name exact topics (e.g. "Solve 3 LeetCode Medium two-pointer problems", "Review REST & idempotency design patterns", "Draft 3 STAR behavioral leadership stories").
- Each task must produce a tangible, verifiable daily outcome.
- requiredEnergy must be one of: "HIGH_FOCUS", "MEDIUM", "LOW_RECOVERY".
- priority must be one of: "P0_CRITICAL", "P1_IMPORTANT", "P2_OPTIONAL".

Return strictly valid JSON matching:
{
  "milestones": [
    {
      "title": "Specific phase title",
      "description": "Strategic milestone outcome",
      "orderIndex": 1,
      "estimatedWeeksFromStart": 1,
      "weeklyTargets": [
        {
          "title": "Focused weekly objective",
          "targetHours": ${weeklyHours},
          "tasks": [
            {
              "title": "Specific actionable task",
              "description": "Tangible output or learning goal",
              "priority": "P0_CRITICAL",
              "estimatedMinutes": 45,
              "requiredEnergy": "HIGH_FOCUS"
            }
          ]
        }
      ]
    }
  ]
}`;

    try {
      const breakdown = await Promise.race([
        ai.generateStructured(prompt, AI_GOAL_BREAKDOWN_SCHEMA),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("AI timeout")), 40000)),
      ]);

      if (breakdown && breakdown.milestones && breakdown.milestones.length > 0) {
        return {
          title: input.title,
          category: input.category || "CAREER",
          durationWeeks,
          weeklyHours,
          targetDate: targetDate.toISOString(),
          whyReason: input.whyReason || `Master ${input.title} with deliberate execution`,
          whyNow: input.whyNow || "Immediate priority for personal momentum",
          costOfInaction: input.costOfInaction || "Stagnation and lost time",
          milestones: breakdown.milestones,
        };
      }
    } catch {
      // Fallback to high-quality procedural roadmap if Ollama takes too long on CPU
    }

    // Procedural fallback roadmap customized to duration
    const proceduralMilestones = [];
    const weeksPerMilestone = Math.max(1, Math.round(durationWeeks / numMilestones));

    for (let i = 1; i <= numMilestones; i++) {
      const isFirst = i === 1;
      const isLast = i === numMilestones;
      const phaseTitle = isFirst
        ? `Phase 1: Foundations & Core Environment`
        : isLast
        ? `Phase ${i}: Live Execution & Output Delivery`
        : `Phase ${i}: Guided Practice & System Refinement`;

      proceduralMilestones.push({
        title: phaseTitle,
        description: `Deliberate milestone execution for ${input.title}`,
        orderIndex: i,
        estimatedWeeksFromStart: i * weeksPerMilestone,
        weeklyTargets: [
          {
            title: `Week ${i}: ${isFirst ? "Initial Setup & Fast Wins" : isLast ? "Mastery & Capstone" : "Skill Drills"}`,
            targetHours: weeklyHours,
            tasks: [
              {
                title: isFirst ? `Setup environment and define scope for ${input.title}` : `Execute core assignment for ${phaseTitle}`,
                description: "Deep focus session to build initial momentum",
                priority: "P0_CRITICAL" as const,
                estimatedMinutes: 45,
                requiredEnergy: "HIGH_FOCUS" as const,
              },
              {
                title: `Complete foundational study and notes on ${input.title}`,
                description: "Solidify mental models and patterns",
                priority: "P1_IMPORTANT" as const,
                estimatedMinutes: 45,
                requiredEnergy: "MEDIUM" as const,
              },
              {
                title: `Synthesize weekly progress summary for ${input.title}`,
                description: "Review insights and unblock next steps",
                priority: "P2_OPTIONAL" as const,
                estimatedMinutes: 30,
                requiredEnergy: "LOW_RECOVERY" as const,
              },
            ],
          },
        ],
      });
    }

    return {
      title: input.title,
      category: input.category || "CAREER",
      durationWeeks,
      weeklyHours,
      targetDate: targetDate.toISOString(),
      whyReason: input.whyReason || `Master ${input.title} with deliberate execution`,
      whyNow: input.whyNow || "Immediate priority for personal momentum",
      costOfInaction: input.costOfInaction || "Stagnation and lost time",
      milestones: proceduralMilestones,
    };
  }

  /**
   * Confirms and commits a personalized roadmap to the database,
   * spreading initial tasks across upcoming days for sustainable daily flow.
   */
  static async confirmRoadmap(userId: string, input: ConfirmRoadmapInput) {
    const targetDate = new Date(input.targetDate);

    // Resolve or create Life Area
    let lifeArea = null;
    const categoryName = input.category || input.lifeAreaName || "Personal Growth";
    lifeArea = await prisma.lifeArea.findFirst({
      where: { userId, name: { contains: categoryName, mode: "insensitive" } },
    });

    if (!lifeArea) {
      lifeArea = await prisma.lifeArea.findFirst({ where: { userId } });
    }

    if (!lifeArea) {
      lifeArea = await prisma.lifeArea.create({
        data: {
          userId,
          name: categoryName,
          icon: "compass",
          color: "#06b6d4",
        },
      });
    }

    const goal = await prisma.$transaction(async (tx) => {
      const createdGoal = await tx.goal.create({
        data: {
          userId,
          lifeAreaId: lifeArea.id,
          title: input.title,
          dreamVision: input.dreamVision || input.title,
          whyReason: input.whyReason || `Master ${input.title}`,
          whyNow: input.whyNow || "High priority horizon",
          costOfInaction: input.costOfInaction || "Opportunity loss",
          successDefinition: input.successDefinition || "100% Roadmap Completion",
          targetDate,
          estimatedHoursTotal: input.estimatedHoursTotal || 40,
          status: "ACTIVE",
        },
      });

      let dayOffset = 0;

      for (const m of input.milestones) {
        const milestoneTarget = new Date();
        milestoneTarget.setDate(milestoneTarget.getDate() + (m.estimatedWeeksFromStart || 1) * 7);

        const milestone = await tx.goalMilestone.create({
          data: {
            goalId: createdGoal.id,
            title: m.title,
            orderIndex: m.orderIndex,
            targetDate: milestoneTarget,
          },
        });

        for (let wIdx = 0; wIdx < m.weeklyTargets.length; wIdx++) {
          const wt = m.weeklyTargets[wIdx];
          const currentWeekNum = Math.ceil(
            (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 7)
          );

          const weeklyTarget = await tx.weeklyTarget.create({
            data: {
              milestoneId: milestone.id,
              title: wt.title,
              weekNumber: currentWeekNum + wIdx,
              year: new Date().getFullYear(),
              targetHours: wt.targetHours || 8,
            },
          });

          for (const t of wt.tasks) {
            const task = await tx.task.create({
              data: {
                weeklyTargetId: weeklyTarget.id,
                title: t.title,
                description: t.description || "",
                priority: (t.priority as PriorityLevel) || PriorityLevel.P1_IMPORTANT,
                estimatedMinutes: t.estimatedMinutes || 45,
                requiredEnergy: (t.requiredEnergy as EnergyLevel) || EnergyLevel.HIGH_FOCUS,
              },
            });

            // Smooth daily distribution across the roadmap: spread tasks across days & weeks!
            const milestoneWeekStart = m.estimatedWeeksFromStart
              ? Math.max(0, m.estimatedWeeksFromStart - 1) * 7
              : (m.orderIndex - 1) * 7;
            const targetBaseDay = milestoneWeekStart + wIdx * 7;
            const taskDayOffset = targetBaseDay + (dayOffset % 5);

            const now = new Date();
            const scheduledDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + taskDayOffset));

            await tx.taskInstance.create({
              data: {
                taskId: task.id,
                scheduledDate,
                status: TaskStatus.PENDING,
              },
            });

            dayOffset += 1;
          }
        }
      }

      return createdGoal;
    }, {
      maxWait: 10000,
      timeout: 25000,
    });

    return this.getGoalJourney(userId, goal.id);
  }

  /**
   * Permanently deletes a goal and cascades cleanup to all milestones, targets, tasks, and scheduled instances
   */
  static async deleteGoal(userId: string, goalId: string) {
    const goal = await prisma.goal.findFirst({
      where: { id: goalId, userId },
      include: {
        milestones: {
          include: {
            weeklyTargets: {
              include: {
                tasks: true,
              },
            },
          },
        },
      },
    });

    if (!goal) {
      throw new NotFoundError("Goal not found or unauthorized");
    }

    await prisma.$transaction(async (tx) => {
      // 1. Unlink memories referencing this goal
      await tx.universalMemory.updateMany({
        where: { goalId },
        data: { goalId: null },
      });

      // 2. Collect child IDs
      const taskIds: string[] = [];
      const targetIds: string[] = [];
      const milestoneIds: string[] = [];

      goal.milestones.forEach((m) => {
        milestoneIds.push(m.id);
        m.weeklyTargets.forEach((wt) => {
          targetIds.push(wt.id);
          wt.tasks.forEach((t) => {
            taskIds.push(t.id);
          });
        });
      });

      // 3. Delete task instances & tasks
      if (taskIds.length > 0) {
        await tx.taskInstance.deleteMany({
          where: { taskId: { in: taskIds } },
        });
        await tx.task.deleteMany({
          where: { id: { in: taskIds } },
        });
      }

      // 4. Delete weekly targets
      if (targetIds.length > 0) {
        await tx.weeklyTarget.deleteMany({
          where: { id: { in: targetIds } },
        });
      }

      // 5. Delete milestones
      if (milestoneIds.length > 0) {
        await tx.goalMilestone.deleteMany({
          where: { id: { in: milestoneIds } },
        });
      }

      // 6. Delete the goal itself
      await tx.goal.delete({
        where: { id: goalId },
      });
    }, {
      maxWait: 10000,
      timeout: 25000,
    });

    return { success: true, message: "Goal and associated roadmap permanently deleted." };
  }

  /**
   * Updates goal attributes and optionally syncs edited milestones, targets, and tasks
   */
  static async updateGoal(userId: string, goalId: string, input: UpdateGoalDTO) {
    const existing = await prisma.goal.findFirst({
      where: { id: goalId, userId },
      include: {
        milestones: {
          include: {
            weeklyTargets: {
              include: {
                tasks: true,
              },
            },
          },
        },
      },
    });

    if (!existing) {
      throw new NotFoundError("Goal not found or unauthorized");
    }

    await prisma.$transaction(async (tx) => {
      const updateData: any = {};
      if (input.title) updateData.title = input.title;
      if (input.whyReason) updateData.whyReason = input.whyReason;
      if (input.dreamVision) updateData.dreamVision = input.dreamVision;
      if (input.targetDate) updateData.targetDate = new Date(input.targetDate);
      if (input.status) updateData.status = input.status;

      if (input.category) {
        let area = await tx.lifeArea.findFirst({
          where: { userId, name: { contains: input.category, mode: "insensitive" } },
        });
        if (!area) {
          area = await tx.lifeArea.create({
            data: {
              userId,
              name: input.category,
              icon: "compass",
              color: "#06b6d4",
            },
          });
        }
        updateData.lifeAreaId = area.id;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.goal.update({
          where: { id: goalId },
          data: updateData,
        });
      }

      // If milestones provided, update or add them
      if (input.milestones && Array.isArray(input.milestones)) {
        for (let mIdx = 0; mIdx < input.milestones.length; mIdx++) {
          const m = input.milestones[mIdx];
          let milestoneId = m.id;

          if (milestoneId) {
            const milestoneUpdate: any = {
              title: m.title,
              orderIndex: m.orderIndex || mIdx + 1,
            };
            if (m.targetDate) {
              milestoneUpdate.targetDate = new Date(m.targetDate);
            }
            await tx.goalMilestone.update({
              where: { id: milestoneId },
              data: milestoneUpdate,
            });
          } else {
            const createdM = await tx.goalMilestone.create({
              data: {
                goalId,
                title: m.title,
                orderIndex: m.orderIndex || mIdx + 1,
                targetDate: m.targetDate ? new Date(m.targetDate) : new Date(Date.now() + (mIdx + 1) * 14 * 24 * 3600 * 1000),
              },
            });
            milestoneId = createdM.id;
          }

          if (m.weeklyTargets && Array.isArray(m.weeklyTargets)) {
            for (let wIdx = 0; wIdx < m.weeklyTargets.length; wIdx++) {
              const wt = m.weeklyTargets[wIdx];
              let targetId = wt.id;

              if (targetId) {
                await tx.weeklyTarget.update({
                  where: { id: targetId },
                  data: {
                    title: wt.title,
                    targetHours: wt.targetHours || 5,
                  },
                });
              } else {
                const currentWeekNum = Math.ceil(
                  (Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24 * 7)
                );
                const createdWt = await tx.weeklyTarget.create({
                  data: {
                    milestoneId: milestoneId!,
                    title: wt.title,
                    weekNumber: currentWeekNum + wIdx,
                    year: new Date().getFullYear(),
                    targetHours: wt.targetHours || 5,
                  },
                });
                targetId = createdWt.id;
              }

              if (wt.tasks && Array.isArray(wt.tasks)) {
                for (const t of wt.tasks) {
                  if (t.id) {
                    await tx.task.update({
                      where: { id: t.id },
                      data: {
                        title: t.title,
                        priority: (t.priority as PriorityLevel) || undefined,
                        estimatedMinutes: t.estimatedMinutes || undefined,
                        requiredEnergy: (t.requiredEnergy as EnergyLevel) || undefined,
                      },
                    });
                  } else {
                    const createdTask = await tx.task.create({
                      data: {
                        weeklyTargetId: targetId!,
                        title: t.title,
                        description: t.description || "",
                        priority: (t.priority as PriorityLevel) || PriorityLevel.P1_IMPORTANT,
                        estimatedMinutes: t.estimatedMinutes || 45,
                        requiredEnergy: (t.requiredEnergy as EnergyLevel) || EnergyLevel.HIGH_FOCUS,
                      },
                    });

                    // Schedule an instance for upcoming day
                    const now = new Date();
                    const scheduledDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + wIdx));
                    await tx.taskInstance.create({
                      data: {
                        taskId: createdTask.id,
                        scheduledDate,
                        status: TaskStatus.PENDING,
                      },
                    });
                  }
                }
              }
            }
          }
        }
      }
    }, {
      maxWait: 10000,
      timeout: 25000,
    });

    return this.getGoalJourney(userId, goalId);
  }
}

