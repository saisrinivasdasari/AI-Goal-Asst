import { describe, it, expect } from "vitest";
import { CapacityService } from "@/features/capacity/capacity.service";

describe("CapacityService Unit Tests", () => {
  it("should calculate correct net available hours under standard commitments", () => {
    // 168 total hours in a week
    // 40h work + (7.5 * 7 = 52.5h sleep) + (1.0 * 5 = 5h commute) + 10h fixed = 107.5h committed
    // Net available: 168 - 107.5 = 60.5 hours
    const net = CapacityService.calculateNetHours({
      dayJobHoursWeekly: 40,
      sleepHoursDaily: 7.5,
      commuteHoursDaily: 1.0,
      fixedCommitmentsWeekly: 10.0,
    });
    expect(net).toBe(60.5);
  });

  it("should clamp net capacity to 0 if commitments exceed 168 hours", () => {
    const net = CapacityService.calculateNetHours({
      dayJobHoursWeekly: 90,
      sleepHoursDaily: 9.0,
      commuteHoursDaily: 3.0,
      fixedCommitmentsWeekly: 30.0,
    });
    expect(net).toBe(0);
  });

  it("should throw a ValidationError if sleep is under 5.0 hours", () => {
    expect(() =>
      CapacityService.calculateNetHours({
        dayJobHoursWeekly: 40,
        sleepHoursDaily: 4.5,
        commuteHoursDaily: 1.0,
        fixedCommitmentsWeekly: 10.0,
      })
    ).toThrow("Sleep under 5.0 hours/day is unsustainable");
  });
});
