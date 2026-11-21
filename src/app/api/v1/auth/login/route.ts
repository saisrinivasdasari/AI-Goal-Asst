import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const LoginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: parsed.error.issues[0]?.message || "Validation failed" } },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();
    const supabase = await createClient();

    let { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    // Auto-confirm on login if email confirmation was pending
    if (error && error.message?.toLowerCase().includes("email not confirmed")) {
      const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
      const existing = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === normalizedEmail
      );
      if (existing) {
        await supabaseAdmin.auth.admin.updateUserById(existing.id, { email_confirm: true });
        const retry = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        data = retry.data;
        error = retry.error;
      }
    }

    if (error) {
      const isFetchFailed = error.message?.toLowerCase().includes("fetch failed");
      const friendlyMessage = isFetchFailed
        ? "Unable to connect to authentication server. Your Supabase project appears to be paused. Please click 'Restore Project' in your Supabase dashboard."
        : error.message;

      return NextResponse.json(
        { error: { message: friendlyMessage } },
        { status: error.status || 401 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: { message: "No user found with these credentials" } },
        { status: 404 }
      );
    }

    // Ensure user record exists in Postgres
    let dbUser = await prisma.user.findUnique({
      where: { id: data.user.id },
      include: { profile: true },
    }).catch(() => null);

    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          id: data.user.id,
          email: data.user.email || normalizedEmail,
          profile: {
            create: {
              fullName: data.user.user_metadata?.full_name || normalizedEmail.split("@")[0],
              timezone: "UTC",
              motivationalStyle: "supportive_friend",
            },
          },
          capacitySchedule: {
            create: {
              dayJobHoursWeekly: 40.0,
              sleepHoursDaily: 7.5,
              commuteHoursDaily: 1.0,
              fixedCommitmentsWeekly: 10.0,
              netAvailableGoalHours: 168 - (7.5 * 7 + 40 + 1.0 * 5 + 10),
              peakEnergyWindow: "HIGH_FOCUS",
            },
          },
          energyProfile: {
            create: {
              morningEnergy: "HIGH_FOCUS",
              afternoonEnergy: "MEDIUM",
              eveningEnergy: "MEDIUM",
              nightEnergy: "LOW_RECOVERY",
            },
          },
        },
        include: { profile: true },
      }).catch(() => null);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        fullName: dbUser?.profile?.fullName || data.user.user_metadata?.full_name || normalizedEmail.split("@")[0],
      },
    });
  } catch (err: any) {
    console.error("[Login Route Error]:", err);
    const msg = err.message || "Failed to authenticate";
    const isNetwork = msg.includes("fetch failed") || msg.includes("ENOTFOUND");

    return NextResponse.json(
      {
        error: {
          message: isNetwork
            ? "Authentication server is unreachable. Please verify that your Supabase project is active and unpaused."
            : msg,
        },
      },
      { status: 500 }
    );
  }
}
