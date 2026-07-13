import nextEnv from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { loadEnvConfig } = nextEnv;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const websiteRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(websiteRoot, "..");

loadEnvConfig(repoRoot);
loadEnvConfig(websiteRoot);

function pickEnv(...names) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

const url = pickEnv("NEXT_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL");
const key = pickEnv(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
);

if (!url || !key) {
  console.error("\n❌ Website build: Supabase env vars are missing or empty.");
  console.error("   Required: NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY");
  console.error("   (or EXPO_PUBLIC_* / SUPABASE_ANON_KEY equivalents)");
  console.error("\n   Local: fill repo root .env — do not leave .env.local keys blank");
  console.error("         (empty .env.local values override .env)");
  console.error("   Vercel: set vars in Project Settings → Environment Variables,");
  console.error("           then trigger a new Production deploy (static export bakes env at build time).\n");
  process.exit(1);
}

console.log("✓ Supabase env present for website build");
