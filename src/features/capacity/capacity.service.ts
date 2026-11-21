import { prisma } from "@/lib/db/prisma";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { EnergyLevel } from "@prisma/client";

export interface CapacityCalculationInput {
  dayJobHoursWeekly: number;
  sleepHoursDaily: number;
  commuteHoursDaily: number;
  fixedCommitmentsWeekly: number;
}

export interface UpdateEnergyProfileInput {
  morningEnergy?: EnergyLevel;
  afternoonEnergy?: EnergyLevel;
  eveningEnergy?: EnergyLevel;
  nightEnergy?: EnergyLevel;
}

export class CapacityService {
  /**
   * Computes realistic net available goal hours per week:
   * 168 hours total - (sleep * 7 + work + commute * 5 + fixed commitments)
   */
  static calculateNetHours(input: CapacityCalculationInput): number {
    const { dayJobHoursWeekly, sleepHoursDaily, commuteHoursDaily, fixedCommitmentsWeekly } = input;

    if (sleepHoursDaily < 5.0) {
      throw new ValidationError("Sleep under 5.0 hours/day is unsustainable for peak cognitive performance.");
    }
    if (dayJobHoursWeekly < 0 || dayJobHoursWeekly > 100) {
      throw new ValidationError("Day job hours must be between 0 and 100.");
    }

    const totalCommitted = sleepHoursDaily * 7 + dayJobHoursWeekly + commuteHoursDaily * 5 + fixedCommitmentsWeekly;
    const net = Math.max(0, parseFloat((168 - totalCommitted).toFixed(1)));

    return net;
  }

  /**
   * Retrieves user capacity schedule
   */
  static async getCapacity(userId: string) {
    const schedule = await prisma.capacitySchedule.findUnique({
      where: { userId },
    });

    if (!schedule) {
      throw new NotFoundError("Capacity schedule not found for user");
    }

    const energyProfile = await prisma.energyProfile.findUnique({
      where: { userId },
    });

    return {
      schedule,
      energyProfile,
    };
  }

  /**
   * Updates user capacity schedule and recomputes netAvailableGoalHours
   */
  static async updateCapacity(userId: string, input: CapacityCalculationInput & { peakEnergyWindow?: EnergyLevel }) {
    const netAvailableGoalHours = this.calculateNetHours(input);

    const updated = await prisma.capacitySchedule.upsert({
      where: { userId },
      update: {
        dayJobHoursWeekly: input.dayJobHoursWeekly,
        sleepHoursDaily: input.sleepHoursDaily,
        commuteHoursDaily: input.commuteHoursDaily,
        fixedCommitmentsWeekly: input.fixedCommitmentsWeekly,
        netAvailableGoalHours,
        ...(input.peakEnergyWindow && { peakEnergyWindow: input.peakEnergyWindow }),
      },
      create: {
        userId,
        dayJobHoursWeekly: input.dayJobHoursWeekly,
        sleepHoursDaily: input.sleepHoursDaily,
        commuteHoursDaily: input.commuteHoursDaily,
        fixedCommitmentsWeekly: input.fixedCommitmentsWeekly,
        netAvailableGoalHours,
        peakEnergyWindow: input.peakEnergyWindow || EnergyLevel.HIGH_FOCUS,
      },
    });

    return updated;
  }

  /**
   * Updates the granular per-time-slot energy profile
   */
  static async updateEnergyProfile(userId: string, input: UpdateEnergyProfileInput) {
    const profile = await prisma.energyProfile.upsert({
      where: { userId },
      update: {
        ...(input.morningEnergy && { morningEnergy: input.morningEnergy }),
        ...(input.afternoonEnergy && { afternoonEnergy: input.afternoonEnergy }),
        ...(input.eveningEnergy && { eveningEnergy: input.eveningEnergy }),
        ...(input.nightEnergy && { nightEnergy: input.nightEnergy }),
      },
      create: {
        userId,
        morningEnergy: input.morningEnergy || EnergyLevel.HIGH_FOCUS,
        afternoonEnergy: input.afternoonEnergy || EnergyLevel.MEDIUM,
        eveningEnergy: input.eveningEnergy || EnergyLevel.MEDIUM,
        nightEnergy: input.nightEnergy || EnergyLevel.LOW_RECOVERY,
      },
    });

    return profile;
  }

  /**
   * Resolves current energy level based on current wall-clock hour and user's energy profile
   */
  static async getCurrentEnergySlot(userId: string): Promise<EnergyLevel> {
    const profile = await prisma.energyProfile.findUnique({
      where: { userId },
    });

    const hour = new Date().getHours();

    if (hour >= 6 && hour < 12) {
      return profile?.morningEnergy || EnergyLevel.HIGH_FOCUS;
    } else if (hour >= 12 && hour < 18) {
      return profile?.afternoonEnergy || EnergyLevel.MEDIUM;
    } else if (hour >= 18 && hour < 21) {
      return profile?.eveningEnergy || EnergyLevel.MEDIUM;
    } else {
      return profile?.nightEnergy || EnergyLevel.LOW_RECOVERY;
    }
  }
}

