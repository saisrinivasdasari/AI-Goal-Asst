import { describe, it, expect, vi, beforeEach } from "vitest";
import { JournalService } from "@/features/journal/journal.service";
import { prisma } from "@/lib/db/prisma";

vi.mock("@/lib/ai/client", () => ({
  getAIProvider: () => ({
    generateStructured: vi.fn().mockRejectedValue(new Error("Use procedural fallback in unit test")),
    embedText: vi.fn().mockResolvedValue(new Array(768).fill(0.01)),
  }),
}));

describe("Journal Hierarchical Knowledge Taxonomy Unit Tests", () => {
  beforeEach(() => {
    vi.spyOn(prisma, "$executeRaw").mockResolvedValue(1 as any);
  });
  it("should categorize badminton technique into Sports & Athletics taxonomy", async () => {
    vi.spyOn(prisma.journalEntry, "create").mockResolvedValueOnce({
      id: "entry-1",
      userId: "user-1",
      rawInputText: "Played badminton today, realized court movement and racket head placement when hitting is critical. Felt energized.",
      entryDate: new Date(),
      detectedMood: "energized",
      createdAt: new Date(),
      items: [
        {
          id: "item-1",
          journalEntryId: "entry-1",
          category: "Sports & Athletics > Outdoor & Racket Games > Badminton Technique",
          content: "Played badminton today... [Takeaway]: Court movement, timing, and deliberate racket placement dictate shot accuracy.",
          isCompleted: true,
        },
      ],
    } as any);

    vi.spyOn(prisma.universalMemory, "create").mockResolvedValueOnce({ id: "mem-1" } as any);
    vi.spyOn(prisma.taskInstance, "findMany").mockResolvedValueOnce([]);

    const result = await JournalService.ingestJournal(
      "user-1",
      "Played badminton today, realized court movement and racket head placement when hitting is critical. Felt energized."
    );

    expect(result.extractedItems).toBeDefined();
    expect(result.extractedItems[0].domain).toBe("Sports & Athletics");
    expect(result.extractedItems[0].category).toBe("Outdoor & Racket Games");
    expect(result.extractedItems[0].topic).toBe("Badminton Technique");
    expect(result.extractedItems[0].memoryType).toBe("LEARNING");
  });

  it("should categorize express cafe concept into Business & Startups taxonomy", async () => {
    vi.spyOn(prisma.journalEntry, "create").mockResolvedValueOnce({
      id: "entry-2",
      userId: "user-1",
      rawInputText: "Got an idea: plan a cafe in a high demand tech zone with minimal menu and faster delivery.",
      entryDate: new Date(),
      detectedMood: "inspired",
      createdAt: new Date(),
      items: [
        {
          id: "item-2",
          journalEntryId: "entry-2",
          category: "Business & Startups > Food & Beverages (QSR) > Express Specialty Cafe",
          content: "Got an idea... [Takeaway]: High-density convenience model with minimal premium menu enables rapid unit economics.",
          isCompleted: true,
        },
      ],
    } as any);

    vi.spyOn(prisma.universalMemory, "create").mockResolvedValueOnce({ id: "mem-2" } as any);
    vi.spyOn(prisma.taskInstance, "findMany").mockResolvedValueOnce([]);

    const result = await JournalService.ingestJournal(
      "user-1",
      "Got an idea: plan a cafe in a high demand tech zone with minimal menu and faster delivery."
    );

    expect(result.extractedItems).toBeDefined();
    expect(result.extractedItems[0].domain).toBe("Business & Startups");
    expect(result.extractedItems[0].category).toBe("Food & Beverages (QSR)");
    expect(result.extractedItems[0].topic).toBe("Express Specialty Cafe");
    expect(result.extractedItems[0].memoryType).toBe("IDEA");
  });

  it("should organize Badminton and Chess into distinct disciplines in getKnowledgeVault", async () => {
    vi.spyOn(prisma.journalEntry, "findMany").mockResolvedValueOnce([
      {
        id: "entry-badminton-1",
        userId: "user-1",
        rawInputText: "Badminton session",
        entryDate: new Date("2026-11-20"),
        detectedMood: "energized",
        createdAt: new Date(),
        items: [
          {
            id: "it-badminton",
            journalEntryId: "entry-badminton-1",
            category: "Sports & Athletics > Badminton > Backhand Clear",
            content: "Practiced backhand clear\n\n[Takeaway]: Rotate forearm early\n[Emotion]: Energized\n[Type]: LEARNING",
            isCompleted: true,
          },
        ],
      },
      {
        id: "entry-chess-1",
        userId: "user-1",
        rawInputText: "Chess tournament game",
        entryDate: new Date("2026-11-21"),
        detectedMood: "focused",
        createdAt: new Date(),
        items: [
          {
            id: "it-chess",
            journalEntryId: "entry-chess-1",
            category: "Sports & Strategy > Chess > Sicilian Defense",
            content: "Played Najdorf variation\n\n[Takeaway]: Control d5 square\n[Emotion]: Focused\n[Type]: LEARNING",
            isCompleted: true,
          },
        ],
      },
    ] as any);

    const vault = await JournalService.getKnowledgeVault("user-1");

    expect(vault.playbooks).toBeDefined();
    expect(vault.playbooks.length).toBeGreaterThanOrEqual(1);

    // Flatten all disciplines across domains
    const allDisciplines = vault.playbooks.flatMap((p) => p.disciplines);
    const badmintonDisc = allDisciplines.find((d) => d.category === "Badminton");
    const chessDisc = allDisciplines.find((d) => d.category === "Chess");

    expect(badmintonDisc).toBeDefined();
    expect(badmintonDisc?.topics[0].title).toBe("Backhand Clear");
    expect(badmintonDisc?.topics[0].takeaways[0].takeaway).toBe("Rotate forearm early");

    expect(chessDisc).toBeDefined();
    expect(chessDisc?.topics[0].title).toBe("Sicilian Defense");
    expect(chessDisc?.topics[0].takeaways[0].takeaway).toBe("Control d5 square");
  });
});
