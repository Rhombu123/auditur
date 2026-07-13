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
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      storageKey: "auditur-dashboard-auth",
    },
  },
);

export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseKey);
}

export function assertSupabaseConfigured(): void {
  if (supabaseConfigured()) return;
  throw new Error(
    "Supabase is not configured in this build. Run website build/dev after setting NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (Vercel: set vars and redeploy).",
  );
}
