import { prisma } from "@/lib/db/prisma";
import { getAIProvider } from "@/lib/ai/client";
import { MemoryType, MemoryDurability, TaskStatus } from "@prisma/client";
import { z } from "zod";

const HIERARCHICAL_JOURNAL_SCHEMA = z.object({
  detectedMood: z.string().default("reflective"),
  items: z.array(
    z.object({
      domain: z.string().default("Personal Life"),
      category: z.string().default("General"),
      topic: z.string().default("Daily Observation"),
      content: z.string(),
      takeaway: z.string().optional().default(""),
      emotionalResonance: z.string().optional().default("Reflective"),
      memoryType: z.enum([
        "GOAL",
        "LEARNING",
        "EXPERIENCE",
        "IDEA",
        "DECISION",
        "HABIT",
        "ACHIEVEMENT",
        "FAILURE",
        "PREFERENCE",
        "REFLECTION",
      ]).default("REFLECTION"),
      importance: z.number().min(1).max(5).default(3),
    })
  ).default([]),
});

export interface PlaybookTopicTakeaway {
  id: string;
  entryId: string;
  date: string;
  takeaway: string;
  content: string;
  emotion?: string;
  memoryType: string;
}

export interface PlaybookTopic {
  title: string;
  count: number;
  lastPracticed: string;
  takeaways: PlaybookTopicTakeaway[];
}

export interface DisciplinePlaybook {
  category: string;
  domain: string;
  icon: string;
  totalEntries: number;
  lastActiveDate: string;
  topics: PlaybookTopic[];
}

export interface DomainKnowledgeHub {
  domain: string;
  icon: string;
  totalEntries: number;
  disciplines: DisciplinePlaybook[];
}

function getTaxonomyIcon(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("badminton") || lower.includes("racket") || lower.includes("tennis")) return "🏸";
  if (lower.includes("chess")) return "♟️";
  if (lower.includes("sport") || lower.includes("athletic") || lower.includes("gym") || lower.includes("fitness")) return "🏆";
  if (lower.includes("code") || lower.includes("tech") || lower.includes("software") || lower.includes("system") || lower.includes("developer")) return "💻";
  if (lower.includes("business") || lower.includes("startup") || lower.includes("idea") || lower.includes("venture") || lower.includes("cafe")) return "💡";
  if (lower.includes("finance") || lower.includes("invest") || lower.includes("wealth") || lower.includes("money") || lower.includes("market")) return "📈";
  if (lower.includes("mind") || lower.includes("psychology") || lower.includes("emotion") || lower.includes("philosoph") || lower.includes("reflect")) return "🧠";
  if (lower.includes("art") || lower.includes("music") || lower.includes("creative") || lower.includes("design")) return "🎨";
  if (lower.includes("health") || lower.includes("nutrition") || lower.includes("longevity")) return "🌿";
  return "📁";
}

export class JournalService {
  /**
   * Ingests a raw natural-language voice/text journal dump,
   * categorizes items into a 3-tier dynamic hierarchy (Domain > Category > Topic),
   * creates vector-embedded universal memories, and auto-completes matching tasks.
   */
  static async ingestJournal(userId: string, rawInputText: string, entryDateStr?: string) {
    const entryDate = entryDateStr ? new Date(entryDateStr) : new Date();
    const ai = getAIProvider();

    let extracted: z.infer<typeof HIERARCHICAL_JOURNAL_SCHEMA>;

    try {
      const prompt = `You are Jarvis, a cognitive life operating system and knowledge architect.
Analyze the user's personal journal entry and decompose it into structured hierarchical knowledge.

Categorize every thought into a 3-tier taxonomy:
1. "domain": High-level sphere (e.g. "Sports & Athletics", "Business & Entrepreneurship", "Technology & Engineering", "Personal Life & Family", "Health & Longevity", "Finance & Wealth", "Arts & Creativity", "Psychology & Mindset").
2. "category": Sub-field (e.g. "Outdoor & Racket Games", "Food & Beverages", "Distributed Systems", "Parenting", "Investing", "Music").
3. "topic": Exact entity/skill (e.g. "Badminton", "Express Cafe Concept", "Redis Caching", "Public Speaking").

Also extract:
- "content": Detailed description of what happened or what was planned.
- "takeaway": One concise sentence capturing the distilled lesson, insight, or idea proposition.
- "emotionalResonance": The psychological state or emotional sentiment (e.g. "Flow State / Energized", "Inspired & Ambitious", "Strategic Curiosity", "Overcoming Friction").
- "memoryType": One of "LEARNING" (skills/techniques), "IDEA" (business/creative proposals), "EXPERIENCE" (personal events), "DECISION" (choices made), "HABIT" (routines), "REFLECTION" (mindset shifts).
- "importance": 1 to 5.

User Input:
"""${rawInputText.trim()}"""
`;

      extracted = await ai.generateStructured(prompt, HIERARCHICAL_JOURNAL_SCHEMA);
    } catch {
      // Procedural Fallback Engine: Dynamically categorizes any situation even if Ollama CPU is busy
      extracted = this.proceduralHierarchicalExtraction(rawInputText);
    }

    if (!extracted.items || extracted.items.length === 0) {
      extracted = this.proceduralHierarchicalExtraction(rawInputText);
    }

    // 2. Persist Journal Entry and Items with Hierarchical Taxonomy Breadcrumbs
    const journalEntry = await prisma.journalEntry.create({
      data: {
        userId,
        rawInputText,
        entryDate,
        detectedMood: extracted.detectedMood,
        items: {
          create: extracted.items.map((it) => {
            const taxonomyPath = `${it.domain.trim()} > ${it.category.trim()} > ${it.topic.trim()}`;
            const formattedContent = `${it.content.trim()}\n\n[Takeaway]: ${it.takeaway?.trim() || it.content.trim()}\n[Emotion]: ${it.emotionalResonance?.trim() || "Reflective"}\n[Type]: ${it.memoryType}`;

            return {
              category: taxonomyPath,
              content: formattedContent,
              isCompleted: true,
            };
          }),
        },
      },
      include: {
        items: true,
      },
    });

    // 3. Generate Vector Embeddings and Persist Universal Memories
    const createdMemories = [];
    for (const item of extracted.items) {
      const taxonomyPath = `${item.domain} > ${item.category} > ${item.topic}`;
      const memoryContent = `${item.content} (Takeaway: ${item.takeaway || item.content} | State: ${item.emotionalResonance || "Reflective"})`;

      try {
        const embedding = await ai.embedText(`${item.topic}: ${item.takeaway || item.content}`, "document");

        const memoryId = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await prisma.$executeRaw`
          INSERT INTO universal_memories (
            id, "userId", type, durability, topic, content, "sourceContext", importance, "isPrivate", "expiresAt", embedding, "createdAt", "updatedAt"
          ) VALUES (
            ${memoryId},
            ${userId},
            ${item.memoryType}::"MemoryType",
            'LONG_TERM'::"MemoryDurability",
            ${item.topic},
            ${memoryContent},
            ${taxonomyPath},
            ${item.importance || 3},
            false,
            NULL,
            ${embedding}::vector,
            NOW(),
            NOW()
          );
        `;

        createdMemories.push({
          id: memoryId,
          topic: item.topic,
          content: memoryContent,
          type: item.memoryType,
          taxonomy: taxonomyPath,
        });
      } catch {
        // Fallback: insert without vector if pgvector extension has temporary glitch
        const fallback = await prisma.universalMemory.create({
          data: {
            userId,
            type: item.memoryType as MemoryType,
            durability: MemoryDurability.LONG_TERM,
            topic: item.topic,
            content: memoryContent,
            sourceContext: taxonomyPath,
            importance: item.importance || 3,
          },
        });
        createdMemories.push(fallback);
      }
    }

    // 4. Auto-complete Matching Pending Tasks for Today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const pendingTodayTasks = await prisma.taskInstance.findMany({
      where: {
        scheduledDate: { gte: today, lt: tomorrow },
        status: TaskStatus.PENDING,
        task: {
          weeklyTarget: {
            milestone: {
              goal: { userId },
            },
          },
        },
      },
      include: { task: true },
    });

    const completedTasksMatched = [];
    for (const pending of pendingTodayTasks) {
      const taskWords = pending.task.title.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      const isMentioned = extracted.items.some((item) =>
        taskWords.some((w) => item.content.toLowerCase().includes(w))
      );

      if (isMentioned) {
        await prisma.taskInstance.update({
          where: { id: pending.id },
          data: {
            status: TaskStatus.COMPLETED,
            completedAt: new Date(),
            notes: "Auto-completed from Conversational Journal",
          },
        });
        completedTasksMatched.push(pending.task.title);
      }
    }

    return {
      journalEntry,
      extractedItems: extracted.items,
      createdMemories,
      completedTasksMatched,
      message: "Journal processed into hierarchical knowledge taxonomy and universal memory",
    };
  }

  /**
   * Procedural Hierarchical Knowledge Extraction:
   * Dynamically categorizes arbitrary life situations (badminton, cafes, guitar, family, code, etc.)
   */
  private static proceduralHierarchicalExtraction(text: string) {
    const lower = text.toLowerCase();

    // 1. Sports & Athletics
    if (
      lower.includes("badminton") ||
      lower.includes("tennis") ||
      lower.includes("racket") ||
      lower.includes("court") ||
      lower.includes("smash") ||
      lower.includes("shuttle") ||
      lower.includes("footwork") ||
      lower.includes("gym") ||
      lower.includes("workout") ||
      lower.includes("running") ||
      lower.includes("marathon")
    ) {
      const isBadminton = lower.includes("badminton") || lower.includes("racket") || lower.includes("shuttle");
      const topic = isBadminton ? "Badminton Technique" : "Physical Training";
      return {
        detectedMood: "energized",
        items: [
          {
            domain: "Sports & Athletics",
            category: isBadminton ? "Outdoor & Racket Games" : "Fitness & Conditioning",
            topic,
            content: text.trim(),
            takeaway: "Court movement, timing, and deliberate racket placement dictate shot accuracy.",
            emotionalResonance: "Flow State • High Energy",
            memoryType: "LEARNING" as const,
            importance: 4,
          },
        ],
      };
    }

    // 2. Business & Entrepreneurship
    if (
      lower.includes("cafe") ||
      lower.includes("coffee") ||
      lower.includes("restaurant") ||
      lower.includes("business") ||
      lower.includes("startup") ||
      lower.includes("demand") ||
      lower.includes("menu") ||
      lower.includes("delivery") ||
      lower.includes("revenue") ||
      lower.includes("customer") ||
      lower.includes("pricing")
    ) {
      const isCafe = lower.includes("cafe") || lower.includes("coffee") || lower.includes("menu");
      const topic = isCafe ? "Express Specialty Cafe" : "New Venture Proposition";
      return {
        detectedMood: "inspired",
        items: [
          {
            domain: "Business & Startups",
            category: isCafe ? "Food & Beverages (QSR)" : "Business Strategy",
            topic,
            content: text.trim(),
            takeaway: "High-density convenience model with minimal premium menu enables rapid unit economics.",
            emotionalResonance: "Inspired • Strategic Ambition",
            memoryType: "IDEA" as const,
            importance: 4,
          },
        ],
      };
    }

    // 3. Technology & Software
    if (
      lower.includes("code") ||
      lower.includes("database") ||
      lower.includes("schema") ||
      lower.includes("api") ||
      lower.includes("backend") ||
      lower.includes("frontend") ||
      lower.includes("typescript") ||
      lower.includes("react") ||
      lower.includes("next.js") ||
      lower.includes("bug") ||
      lower.includes("redis") ||
      lower.includes("postgres")
    ) {
      return {
        detectedMood: "productive",
        items: [
          {
            domain: "Technology & Engineering",
            category: "System Architecture",
            topic: "Software Design & Implementation",
            content: text.trim(),
            takeaway: "Modular architecture and strict data contracts prevent downstream regressions.",
            emotionalResonance: "Deep Focus • Intellectual Clarity",
            memoryType: "LEARNING" as const,
            importance: 4,
          },
        ],
      };
    }

    // 4. Finance & Wealth
    if (
      lower.includes("invest") ||
      lower.includes("stock") ||
      lower.includes("trading") ||
      lower.includes("crypto") ||
      lower.includes("portfolio") ||
      lower.includes("dividend") ||
      lower.includes("capital")
    ) {
      return {
        detectedMood: "strategic",
        items: [
          {
            domain: "Finance & Wealth",
            category: "Capital Allocation & Investing",
            topic: "Market Strategy",
            content: text.trim(),
            takeaway: "Risk-adjusted position sizing and disciplined execution compound returns.",
            emotionalResonance: "Calculated • Disciplined",
            memoryType: "DECISION" as const,
            importance: 4,
          },
        ],
      };
    }

    // 5. General Personal Life & Philosophy
    return {
      detectedMood: "reflective",
      items: [
        {
          domain: "Personal Life & Mindset",
          category: "Daily Reflection",
          topic: "Life Insight",
          content: text.trim(),
          takeaway: "Consistent reflection builds self-awareness and intentional daily focus.",
          emotionalResonance: "Mindful • Grounded",
          memoryType: "REFLECTION" as const,
          importance: 3,
        },
      ],
    };
  }

  /**
   * Retrieves recent journal entries with parsed hierarchical items
   */
  static async listEntries(userId: string, limit: number = 20) {
    const entries = await prisma.journalEntry.findMany({
      where: { userId },
      include: { items: true },
      orderBy: { entryDate: "desc" },
      take: limit,
    });

    return entries.map((entry) => ({
      ...entry,
      items: entry.items.map((it) => {
        const parts = it.category.split(" > ");
        const domain = parts[0] || "General";
        const category = parts[1] || "Reflection";
        const topic = parts[2] || "Insight";

        // Extract [Takeaway], [Emotion], [Type] from formatted content
        let cleanContent = it.content;
        let takeaway = "";
        let emotion = "";
        let memoryType = "REFLECTION";

        const takeawayMatch = it.content.match(/\[Takeaway\]:\s*([^\n]+)/);
        const emotionMatch = it.content.match(/\[Emotion\]:\s*([^\n]+)/);
        const typeMatch = it.content.match(/\[Type\]:\s*([^\n]+)/);

        if (takeawayMatch) takeaway = takeawayMatch[1].trim();
        if (emotionMatch) emotion = emotionMatch[1].trim();
        if (typeMatch) memoryType = typeMatch[1].trim();

        cleanContent = it.content.split("\n\n[Takeaway]:")[0].trim();

        return {
          id: it.id,
          taxonomyPath: it.category,
          domain,
          category,
          topic,
          content: cleanContent,
          takeaway,
          emotion,
          memoryType,
          isCompleted: it.isCompleted,
        };
      }),
    }));
  }

  /**
   * Aggregates user knowledge into a structured Knowledge Vault
   * with both legacy banks and hierarchical Domain -> Discipline -> Topic playbooks
   */
  static async getKnowledgeVault(userId: string) {
    const entries = await this.listEntries(userId, 100);

    const domainsMap = new Map<string, number>();
    const ideaBank: any[] = [];
    const learningBank: any[] = [];
    const reflectionBank: any[] = [];

    // Hierarchical Playbook Aggregator
    const domainsHubMap = new Map<
      string,
      {
        domain: string;
        icon: string;
        disciplinesMap: Map<
          string,
          {
            category: string;
            domain: string;
            icon: string;
            lastActiveDate: string;
            topicsMap: Map<
              string,
              {
                title: string;
                count: number;
                lastPracticed: string;
                takeaways: PlaybookTopicTakeaway[];
              }
            >;
          }
        >;
      }
    >();

    entries.forEach((entry) => {
      entry.items.forEach((item: any) => {
        // Count domain frequencies
        const count = domainsMap.get(item.domain) || 0;
        domainsMap.set(item.domain, count + 1);

        const card = {
          ...item,
          entryId: entry.id,
          entryDate: entry.entryDate,
          rawQuote: entry.rawInputText,
        };

        if (item.memoryType === "IDEA" || item.domain.toLowerCase().includes("business")) {
          ideaBank.push(card);
        } else if (item.memoryType === "LEARNING" || item.domain.toLowerCase().includes("sports")) {
          learningBank.push(card);
        } else {
          reflectionBank.push(card);
        }

        // Hierarchical taxonomy grouping
        const domainName = item.domain || "General Life";
        const disciplineName = item.category || "General Focus";
        const topicName = item.topic || "Daily Note";
        const entryDateStr = entry.entryDate instanceof Date ? entry.entryDate.toISOString() : String(entry.entryDate);

        if (!domainsHubMap.has(domainName)) {
          domainsHubMap.set(domainName, {
            domain: domainName,
            icon: getTaxonomyIcon(domainName),
            disciplinesMap: new Map(),
          });
        }
        const domainHub = domainsHubMap.get(domainName)!;

        if (!domainHub.disciplinesMap.has(disciplineName)) {
          domainHub.disciplinesMap.set(disciplineName, {
            category: disciplineName,
            domain: domainName,
            icon: getTaxonomyIcon(disciplineName),
            lastActiveDate: entryDateStr,
            topicsMap: new Map(),
          });
        }
        const discipline = domainHub.disciplinesMap.get(disciplineName)!;

        if (new Date(entryDateStr) > new Date(discipline.lastActiveDate)) {
          discipline.lastActiveDate = entryDateStr;
        }

        if (!discipline.topicsMap.has(topicName)) {
          discipline.topicsMap.set(topicName, {
            title: topicName,
            count: 0,
            lastPracticed: entryDateStr,
            takeaways: [],
          });
        }
        const topic = discipline.topicsMap.get(topicName)!;
        topic.count += 1;
        if (new Date(entryDateStr) > new Date(topic.lastPracticed)) {
          topic.lastPracticed = entryDateStr;
        }

        topic.takeaways.push({
          id: item.id,
          entryId: entry.id,
          date: entryDateStr,
          takeaway: item.takeaway || item.content,
          content: item.content,
          emotion: item.emotion,
          memoryType: item.memoryType,
        });
      });
    });

    const domains = Array.from(domainsMap.entries()).map(([name, count]) => ({
      name,
      count,
    }));

    const playbooks: DomainKnowledgeHub[] = Array.from(domainsHubMap.values())
      .map((d) => {
        const disciplines: DisciplinePlaybook[] = Array.from(d.disciplinesMap.values())
          .map((disc) => {
            const topics: PlaybookTopic[] = Array.from(disc.topicsMap.values()).sort(
              (a, b) => new Date(b.lastPracticed).getTime() - new Date(a.lastPracticed).getTime()
            );
            const totalEntries = topics.reduce((acc, t) => acc + t.count, 0);
            return {
              category: disc.category,
              domain: disc.domain,
              icon: disc.icon,
              totalEntries,
              lastActiveDate: disc.lastActiveDate,
              topics,
            };
          })
          .sort((a, b) => b.totalEntries - a.totalEntries);

        const totalEntries = disciplines.reduce((acc, disc) => acc + disc.totalEntries, 0);
        return {
          domain: d.domain,
          icon: d.icon,
          totalEntries,
          disciplines,
        };
      })
      .sort((a, b) => b.totalEntries - a.totalEntries);

    return {
      domains,
      playbooks,
      ideaBank,
      learningBank,
      reflectionBank,
      totalEntries: entries.length,
      totalItems: ideaBank.length + learningBank.length + reflectionBank.length,
    };
  }
}
