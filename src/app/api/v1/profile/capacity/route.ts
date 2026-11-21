import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { CapacityService } from "@/features/capacity/capacity.service";
import { z } from "zod";
import { AppError } from "@/lib/errors";

const UpdateCapacitySchema = z.object({
  dayJobHoursWeekly: z.number().min(0).max(100).optional(),
  workHoursPerWeek: z.number().min(0).max(100).optional(),
  sleepHoursDaily: z.number().min(5).max(14),
  commuteHoursDaily: z.number().min(0).max(6).optional(),
  fixedCommitmentsWeekly: z.number().min(0).max(50).optional(),
  nonNegotiablesHoursPerWeek: z.number().min(0).max(50).optional(),
  peakEnergyWindow: z.enum(["HIGH_FOCUS", "MEDIUM", "LOW_RECOVERY"]).optional(),
  energySlots: z.record(z.string(), z.string()).optional(),
  energyProfile: z
    .object({
      morningEnergy: z.enum(["HIGH_FOCUS", "MEDIUM", "LOW_RECOVERY"]).optional(),
      afternoonEnergy: z.enum(["HIGH_FOCUS", "MEDIUM", "LOW_RECOVERY"]).optional(),
      eveningEnergy: z.enum(["HIGH_FOCUS", "MEDIUM", "LOW_RECOVERY"]).optional(),
      nightEnergy: z.enum(["HIGH_FOCUS", "MEDIUM", "LOW_RECOVERY"]).optional(),
    })
    .optional(),
});

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const data = await CapacityService.getCapacity(user.id);
    return NextResponse.json({
      success: true,
      data: {
        schedule: data.schedule,
        capacityProfile: {
          workHoursPerWeek: data.schedule.dayJobHoursWeekly,
          sleepHoursDaily: data.schedule.sleepHoursDaily,
          nonNegotiablesHoursPerWeek: data.schedule.fixedCommitmentsWeekly,
          netAvailableGoalHours: data.schedule.netAvailableGoalHours,
        },
        energyProfile: data.energyProfile,
      },
      schedule: data.schedule,
      energyProfile: data.energyProfile,
    });
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to load capacity profile" } },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const body = await req.json();
    const parsed = UpdateCapacitySchema.parse(body);

    const dayJob = parsed.dayJobHoursWeekly ?? parsed.workHoursPerWeek ?? 40;
    const fixed = parsed.fixedCommitmentsWeekly ?? parsed.nonNegotiablesHoursPerWeek ?? 10;
    const commute = parsed.commuteHoursDaily ?? 1.0;

    const schedule = await CapacityService.updateCapacity(user.id, {
      dayJobHoursWeekly: dayJob,
      sleepHoursDaily: parsed.sleepHoursDaily,
      commuteHoursDaily: commute,
      fixedCommitmentsWeekly: fixed,
      peakEnergyWindow: parsed.peakEnergyWindow,
    });

    let energyProfile = null;
    if (parsed.energyProfile) {
      energyProfile = await CapacityService.updateEnergyProfile(user.id, parsed.energyProfile);
    }

    return NextResponse.json({
      success: true,
      data: { schedule, energyProfile },
      schedule,
      energyProfile,
      message: "Capacity and energy schedule updated successfully",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", issues: error.issues } },
        { status: 422 }
      );
    }
    if (error instanceof AppError) {
      return NextResponse.json(error.toJSON(), { status: error.statusCode });
    }
    return NextResponse.json(
      { success: false, error: { code: "INTERNAL_ERROR", message: "Failed to update capacity" } },
      { status: 500 }
    );
  }
}
