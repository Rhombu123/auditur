import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Static access only — Next.js inlines NEXT_PUBLIC_* at compile time (dynamic lookup fails). */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || undefined;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || undefined;

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
    "Supabase is not configured in this build. Local: add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to website/.env.local. Vercel: set the same vars, then redeploy (static export embeds env at build time).",
  );
}
