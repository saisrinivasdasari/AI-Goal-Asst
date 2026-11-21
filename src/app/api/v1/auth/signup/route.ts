import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";

const SignUpSchema = z.object({
  fullName: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = SignUpSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: { message: parsed.error.issues[0]?.message || "Validation failed" } },
        { status: 400 }
      );
    }

    const { fullName, email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Create or update user via Supabase Admin API with email_confirm: true (NO email verification needed)
    let authUser: { id: string; email?: string } | null = null;

    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true, // Auto-confirm email immediately
      user_metadata: {
        full_name: fullName.trim(),
      },
    });

    if (createError) {
      const msg = createError.message?.toLowerCase() || "";
      // If account already exists in auth, update its password, verify it, and log in
      if (msg.includes("already registered") || msg.includes("already exists")) {
        const { data: usersData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = usersData?.users?.find(
          (u) => u.email?.toLowerCase() === normalizedEmail
        );

        if (existing) {
          const { data: updateData, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            existing.id,
            {
              password,
              email_confirm: true,
              user_metadata: { full_name: fullName.trim() },
            }
          );
          if (updateError) {
            return NextResponse.json({ error: { message: updateError.message } }, { status: 400 });
          }
          authUser = updateData.user;
        } else {
          return NextResponse.json({ error: { message: createError.message } }, { status: 400 });
        }
      } else {
        return NextResponse.json({ error: { message: createError.message } }, { status: 400 });
      }
    } else {
      authUser = createData.user;
    }

    if (!authUser) {
      return NextResponse.json({ error: { message: "Failed to provision user" } }, { status: 500 });
    }

    // 2. Immediately log the user in so session cookies are established
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (signInError) {
      console.warn("[SignUp auto-signIn warning]:", signInError);
    }

    // 3. Provision user records in PostgreSQL database
    try {
      const existingDb = await prisma.user.findUnique({
        where: { id: authUser.id },
      });

      if (!existingDb) {
        await prisma.user.create({
          data: {
            id: authUser.id,
            email: normalizedEmail,
            profile: {
              create: {
                fullName: fullName.trim(),
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
        });
      }
    } catch (dbErr) {
      console.warn("[SignUp DB provision warning]:", dbErr);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: authUser.id,
        email: normalizedEmail,
        fullName: fullName.trim(),
      },
      sessionCreated: true,
      message: "Account created and logged in successfully!",
    });
  } catch (err: any) {
    console.error("[SignUp Route Error]:", err);
    return NextResponse.json(
      { error: { message: err.message || "Failed to register account" } },
      { status: 500 }
    );
  }
}
