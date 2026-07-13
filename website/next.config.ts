import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const websiteRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(websiteRoot, "..");

// Load repo root first (mobile .env / .env.local), then website overrides.
loadEnvConfig(repoRoot);
loadEnvConfig(websiteRoot);

function pickEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

const supabaseUrl = pickEnv("NEXT_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_URL");
const supabaseAnonKey = pickEnv(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_ANON_KEY",
);

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  outputFileTracingRoot: websiteRoot,
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  },
};

export default nextConfig;
