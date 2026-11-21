import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut();

    return NextResponse.json({ success: true, message: "Logged out successfully" });
  } catch (err: any) {
    console.error("[Logout Route Error]:", err);
    return NextResponse.json({ error: { message: err.message || "Failed to log out" } }, { status: 500 });
  }
}

