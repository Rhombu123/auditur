import { createHmac } from "node:crypto";

import type { VercelRequest } from "@vercel/node";

import {
  createAdminClient,
  getSupabaseAnonKey,
  getSupabaseServiceRoleKey,
  hasServiceRoleKey,
} from "./supabase/admin.js";

export class ApiRateLimitError extends Error {
  readonly status = 429;
}

function secret(): string | null {
  return (
    process.env.RATE_LIMIT_PEPPER ??
    getSupabaseServiceRoleKey() ??
    (() => {
      try {
        return getSupabaseAnonKey();
      } catch {
        return null;
      }
    })()
  );
}

function hash(value: string, pepper: string): string {
  return createHmac("sha256", pepper).update(value).digest("hex");
}

function clientAddress(req: VercelRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.split(",")[0]?.trim() || "unknown";
}

async function consume(
  route: string,
  rateKeyHash: string,
  maxRequests: number,
  windowSeconds: number,
): Promise<void> {
  if (!hasServiceRoleKey()) {
    // Rate limiting requires the service-role RPC path; skip rather than fail uploads.
    return;
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("consume_api_rate_limit", {
    target_route: route,
    target_key_hash: rateKeyHash,
    target_window_seconds: windowSeconds,
    target_max_requests: maxRequests,
  });
  if (error) throw error;
  if (data !== true) {
    throw new ApiRateLimitError("Too many requests. Try again later.");
  }
}

export async function requireApiRateLimit(
  req: VercelRequest,
  options: {
    route: string;
    userId?: string;
    dealershipId?: string;
    maxPerMinute: number;
  },
): Promise<void> {
  const pepper = secret();
  if (!pepper || !hasServiceRoleKey()) {
    return;
  }

  await Promise.all([
    consume(
      `${options.route}:ip`,
      hash(clientAddress(req), pepper),
      options.maxPerMinute * 2,
      60,
    ),
    options.userId
      ? consume(
          `${options.route}:account`,
          hash(`${options.userId}:${options.dealershipId ?? ""}`, pepper),
          options.maxPerMinute,
          60,
        )
      : Promise.resolve(),
  ]);
}
