import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function pickEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

const supabaseUrl = pickEnv("NEXT_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL");
const supabaseKey = pickEnv(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
);

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
    "Supabase is not configured in this build. Local: set EXPO_PUBLIC_SUPABASE_ANON_KEY in .env (and remove blank overrides in .env.local). Vercel: set NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY, then redeploy — static export embeds env at build time, not runtime.",
  );
}
