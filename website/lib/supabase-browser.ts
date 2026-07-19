import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/generated/supabase-env";

const supabaseUrl = SUPABASE_URL || undefined;
const supabaseKey = SUPABASE_ANON_KEY || undefined;

export const supabase: SupabaseClient = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseKey ?? "placeholder-anon-key",
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
      storageKey: "auditur-dashboard-auth",
    },
  },
);

export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey && !supabaseUrl.includes("placeholder"));
}

export function assertSupabaseConfigured(): void {
  if (supabaseConfigured()) return;
  throw new Error(
    "Supabase is not configured in this build. Open the auditur-ruby Vercel project, confirm Production env vars, then Redeploy from the latest main commit (not an old deployment).",
  );
}
