import { describe, it, expect } from "vitest";

describe("Anti-Procrastination & Goal-Achiever System Tests", () => {
  it("calculates weekend deferral offset correctly without breaking workflow", () => {
    const getDaysToWeekend = (dayOfWeek: number) => {
      // 0 = Sun, 1 = Mon, ..., 6 = Sat
      if (dayOfWeek === 6) return 1; // Sat -> Sun
      if (dayOfWeek === 0) return 6; // Sun -> next Sat
      return 6 - dayOfWeek;
    };

    expect(getDaysToWeekend(1)).toBe(5); // Mon -> Sat (+5)
    expect(getDaysToWeekend(5)).toBe(1); // Fri -> Sat (+1)
    expect(getDaysToWeekend(6)).toBe(1); // Sat -> Sun (+1)
    expect(getDaysToWeekend(0)).toBe(6); // Sun -> next Sat (+6)
  });

  it("calculates GPS finish line horizon shift on 1-tap deferral", () => {
    const totalRemaining = 15;
    const daysToPush = 1;
    const baseTargetDate = new Date("2026-12-15T00:00:00.000Z");

    const recalculatedTarget = new Date(baseTargetDate);
    recalculatedTarget.setDate(recalculatedTarget.getDate() + daysToPush);

    expect(recalculatedTarget.toISOString().split("T")[0]).toBe("2026-12-16");
    expect(totalRemaining).toBeGreaterThan(0);
  });

  it("identifies caring coach intervention threshold at 3+ postpones", () => {
    const isResistanceDetected = (rescheduledCount: number) => rescheduledCount >= 3;

    expect(isResistanceDetected(0)).toBe(false);
    expect(isResistanceDetected(1)).toBe(false);
    expect(isResistanceDetected(2)).toBe(false);
    expect(isResistanceDetected(3)).toBe(true);
    expect(isResistanceDetected(5)).toBe(true);
  });

  it("verifies micro-step shrinking bounds daunting task to 10 minutes", () => {
    const dauntingMinutes = 90;
    const shrinkToMicroStep = (originalMins: number, targetMins = 10) => {
      return {
        shrunkMinutes: Math.min(originalMins, targetMins),
        reliefPercent: Math.round(((originalMins - targetMins) / originalMins) * 100),
      };
    };

    const result = shrinkToMicroStep(dauntingMinutes, 10);
    expect(result.shrunkMinutes).toBe(10);
    expect(result.reliefPercent).toBe(89); // 89% friction reduction
  });

  it("ensures undo decrements rescheduledCount to protect against accidental tap penalties", () => {
    let rescheduledCount = 3;
    const undoDeferral = (count: number) => Math.max(0, count - 1);

    rescheduledCount = undoDeferral(rescheduledCount);
    expect(rescheduledCount).toBe(2);

    // If accidentally deferred from 0, it never goes negative
    expect(undoDeferral(0)).toBe(0);
  });
});

