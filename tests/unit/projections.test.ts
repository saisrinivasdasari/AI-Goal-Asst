import { describe, it, expect } from "vitest";

describe("Future You 3-Trajectory Projections Math Tests", () => {
  it("should calculate early completion for accelerated trajectory", () => {
    const daysRemaining = 60;
    const acceleratedDaysDelta = -Math.round(daysRemaining * 0.15); // -9 days
    expect(acceleratedDaysDelta).toBe(-9);

    const now = new Date("2026-11-01T00:00:00Z");
    const targetDate = new Date("2026-12-31T00:00:00Z");
    const acceleratedDate = new Date(targetDate);
    acceleratedDate.setDate(acceleratedDate.getDate() + acceleratedDaysDelta);

    expect(acceleratedDate.getTime()).toBeLessThan(targetDate.getTime());
  });

  it("should calculate realistic buffer for baseline trajectory", () => {
    const daysRemaining = 60;
    const baselineDaysDelta = Math.round(daysRemaining * 0.1); // +6 days buffer
    expect(baselineDaysDelta).toBe(6);
  });

  it("should calculate severe postponement for drift avoidance trajectory", () => {
    const daysRemaining = 60;
    const driftDaysDelta = Math.round(daysRemaining * 0.65); // +39 days drift
    expect(driftDaysDelta).toBe(39);
  });
});

