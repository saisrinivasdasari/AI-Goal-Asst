import { createClient } from "@supabase/supabase-js";

/**
 * Supabase admin client utilizing the SERVICE_ROLE key.
 * Strictly used for server-side operations requiring RLS bypass (e.g. system jobs, migrations).
 * NEVER expose or use on the client browser.
 */
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

