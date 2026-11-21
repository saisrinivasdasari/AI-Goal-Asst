import { createClient } from "./supabase/server";
import { prisma } from "./db/prisma";
import { UnauthorizedError } from "./errors";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName?: string;
}

const DEFAULT_DEV_EMAIL = "user@jarvis.local";

/**
 * Resolves current authenticated user from Supabase session,
 * provisions database records, or falls back to dev user if unauthenticated.
 */
export async function getAuthenticatedUser(allowDevFallback: boolean = true): Promise<AuthenticatedUser> {
  let supabaseUser: { id: string; email: string; user_metadata?: Record<string, any> } | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user && user.email) {
      supabaseUser = {
        id: user.id,
        email: user.email,
        user_metadata: user.user_metadata,
      };

      try {
        // Ensure User record exists in Postgres
        let dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          include: { profile: true },
        });

        if (!dbUser) {
          dbUser = await prisma.user.create({
            data: {
              id: user.id,
              email: user.email,
              profile: {
                create: {
                  fullName: user.user_metadata?.full_name || user.email.split("@")[0] || "Jarvis User",
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
          });

          // Initialize default life areas
          await seedDefaultLifeAreas(dbUser.id);
        }

        return {
          id: dbUser.id,
          email: dbUser.email,
          fullName: dbUser.profile?.fullName || user.user_metadata?.full_name || dbUser.email.split("@")[0],
        };
      } catch (dbErr) {
        // Database is temporarily connecting/unreachable, but user IS authenticated via Supabase!
        console.warn("[Auth DB Provision Warning]:", dbErr);
        return {
          id: user.id,
          email: user.email,
          fullName: user.user_metadata?.full_name || user.email.split("@")[0] || "User",
        };
      }
    }
  } catch {
    // Cookie store not available (e.g. script/test context)
  }

  // If a real Supabase user was identified, never fall back to Default Traveler!
  if (supabaseUser) {
    return {
      id: supabaseUser.id,
      email: supabaseUser.email,
      fullName: supabaseUser.user_metadata?.full_name || supabaseUser.email.split("@")[0] || "User",
    };
  }

  if (!allowDevFallback) {
    throw new UnauthorizedError("Authentication required to access this resource");
  }

  // Fallback ONLY when there is no user session at all (e.g. local dev without login)
  try {
    let devUser = await prisma.user.findUnique({
      where: { email: DEFAULT_DEV_EMAIL },
      include: { profile: true },
    });

    if (!devUser) {
      devUser = await prisma.user.create({
        data: {
          email: DEFAULT_DEV_EMAIL,
          profile: {
            create: {
              fullName: "Default Traveler",
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
      });

      await seedDefaultLifeAreas(devUser.id);
    }

    return {
      id: devUser.id,
      email: devUser.email,
      fullName: devUser.profile?.fullName || "Default Traveler",
    };
  } catch {
    // If DB is unreachable and no auth, return default fallback
    return {
      id: "dev-user-default",
      email: DEFAULT_DEV_EMAIL,
      fullName: "Default Traveler",
    };
  }
}

async function seedDefaultLifeAreas(userId: string) {
  const defaultAreas = [
    { name: "Career & Craft", icon: "briefcase", color: "#3b82f6", targetShare: 0.3 },
    { name: "Fitness & Health", icon: "activity", color: "#10b981", targetShare: 0.2 },
    { name: "Deep Learning", icon: "book-open", color: "#8b5cf6", targetShare: 0.2 },
    { name: "Relationships", icon: "users", color: "#ec4899", targetShare: 0.15 },
    { name: "Financial Freedom", icon: "dollar-sign", color: "#f59e0b", targetShare: 0.15 },
  ];

  for (const area of defaultAreas) {
    await prisma.lifeArea.upsert({
      where: {
        userId_name: {
          userId,
          name: area.name,
        },
      },
      update: {},
      create: {
        userId,
        name: area.name,
        icon: area.icon,
        color: area.color,
        targetShare: area.targetShare,
      },
    }).catch(() => null);
  }
}
