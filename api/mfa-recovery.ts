import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import type { VercelRequest, VercelResponse } from "@vercel/node";

import { ApiAuthError, requireApiAccess } from "../lib/api-auth.js";
import {
  ApiRateLimitError,
  requireApiRateLimit,
} from "../lib/api-rate-limit.js";
import { createAdminClient } from "../lib/supabase/admin.js";

type RecoveryAction = "generate" | "recover" | "admin-reset";

function bearerToken(req: VercelRequest): string | null {
  const value = Array.isArray(req.headers.authorization)
    ? req.headers.authorization[0]
    : req.headers.authorization;
  return value?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? null;
}

function recoveryKey(): string {
  const key =
    process.env.MFA_RECOVERY_PEPPER ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error("MFA recovery secret is not configured.");
  return key;
}

async function revokeAllSessions(userId: string): Promise<void> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Supabase admin environment is not configured.");
  const response = await fetch(
    `${url.replace(/\/$/, "")}/auth/v1/admin/users/${encodeURIComponent(userId)}/logout`,
    {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    },
  );
  if (!response.ok) {
    throw new Error("Could not revoke user sessions.");
  }
}

function normalizeCode(code: string): string {
  return code.replace(/[^A-Z0-9]/gi, "").toUpperCase();
}

function hashCode(code: string): string {
  return createHmac("sha256", recoveryKey())
    .update(normalizeCode(code))
    .digest("hex");
}

function generateCode(): string {
  const raw = randomBytes(9).toString("base64url").toUpperCase().slice(0, 12);
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
}

async function authenticatedUser(req: VercelRequest) {
  const token = bearerToken(req);
  if (!token) throw new ApiAuthError("Authentication required.", 401);
  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    throw new ApiAuthError("Your session is invalid or expired.", 401);
  }
  return { admin, token, user: data.user };
}

async function audit(
  admin: ReturnType<typeof createAdminClient>,
  values: {
    actorUserId?: string;
    targetUserId?: string;
    dealershipId?: string;
    action: string;
    outcome: "success" | "denied" | "failed";
    requestId: string;
  },
) {
  await admin.from("security_audit_events").insert({
    actor_user_id: values.actorUserId,
    target_user_id: values.targetUserId,
    dealership_id: values.dealershipId,
    action: values.action,
    outcome: values.outcome,
    request_id: values.requestId,
  });
}

async function generateRecoveryCodes(req: VercelRequest, requestId: string) {
  const { admin, user } = await authenticatedUser(req);
  const token = bearerToken(req)!;
  const { data: claims, error: claimsError } = await admin.auth.getClaims(token);
  if (claimsError || claims?.claims.aal !== "aal2") {
    throw new ApiAuthError("Complete multi-factor authentication first.", 403);
  }

  const codes = Array.from({ length: 10 }, generateCode);
  await admin.from("mfa_recovery_codes").delete().eq("user_id", user.id);
  const { error } = await admin.from("mfa_recovery_codes").insert(
    codes.map((code) => ({ user_id: user.id, code_hash: hashCode(code) })),
  );
  if (error) throw error;
  await audit(admin, {
    actorUserId: user.id,
    targetUserId: user.id,
    action: "mfa_recovery_codes_generated",
    outcome: "success",
    requestId,
  });
  return { codes };
}

async function recoverWithCode(
  req: VercelRequest,
  requestId: string,
  code: string,
) {
  const { admin, user } = await authenticatedUser(req);
  const since = new Date(Date.now() - 15 * 60_000).toISOString();
  const { count } = await admin
    .from("security_audit_events")
    .select("id", { count: "exact", head: true })
    .eq("actor_user_id", user.id)
    .eq("action", "mfa_recovery_failed")
    .gte("created_at", since);
  if ((count ?? 0) >= 5) {
    throw new ApiAuthError("Too many recovery attempts. Try again later.", 403);
  }

  const candidateHash = hashCode(code);
  const { data: candidates } = await admin
    .from("mfa_recovery_codes")
    .select("id, code_hash")
    .eq("user_id", user.id)
    .is("used_at", null);
  const match = candidates?.find((candidate) => {
    const expected = Buffer.from(candidate.code_hash, "hex");
    const actual = Buffer.from(candidateHash, "hex");
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  });
  if (!match) {
    await audit(admin, {
      actorUserId: user.id,
      targetUserId: user.id,
      action: "mfa_recovery_failed",
      outcome: "denied",
      requestId,
    });
    throw new ApiAuthError("That recovery code is invalid or already used.", 403);
  }

  const { data: consumed } = await admin
    .from("mfa_recovery_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", match.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();
  if (!consumed) throw new ApiAuthError("That recovery code is already used.", 403);

  const { data: factors, error: factorsError } =
    await admin.auth.admin.mfa.listFactors({ userId: user.id });
  if (factorsError) throw factorsError;
  for (const factor of factors.factors) {
    await admin.auth.admin.mfa.deleteFactor({ userId: user.id, id: factor.id });
  }
  await revokeAllSessions(user.id);
  await audit(admin, {
    actorUserId: user.id,
    targetUserId: user.id,
    action: "mfa_recovery_completed",
    outcome: "success",
    requestId,
  });
  return { recovered: true };
}

async function adminReset(
  req: VercelRequest,
  requestId: string,
  targetUserId: string,
) {
  const access = await requireApiAccess(req, "manage_members");
  const admin = createAdminClient();
  const { data: target } = await admin
    .from("dealership_members")
    .select("membership_kind")
    .eq("dealership_id", access.dealershipId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (!target || target.membership_kind === "owner") {
    throw new ApiAuthError("Only non-owner team members can be reset.", 403);
  }
  const { data: factors, error } = await admin.auth.admin.mfa.listFactors({
    userId: targetUserId,
  });
  if (error) throw error;
  for (const factor of factors.factors) {
    await admin.auth.admin.mfa.deleteFactor({ userId: targetUserId, id: factor.id });
  }
  await revokeAllSessions(targetUserId);
  await audit(admin, {
    actorUserId: access.userId,
    targetUserId,
    dealershipId: access.dealershipId,
    action: "mfa_admin_reset",
    outcome: "success",
    requestId,
  });
  return { reset: true };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = randomUUID();
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Request-ID", requestId);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed.", requestId });
  }
  try {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = body.action as RecoveryAction;
    await requireApiRateLimit(req, {
      route: `mfa-recovery:${action || "invalid"}`,
      maxPerMinute: action === "recover" ? 5 : 10,
    });
    const result =
      action === "generate"
        ? await generateRecoveryCodes(req, requestId)
        : action === "recover" && typeof body.code === "string"
          ? await recoverWithCode(req, requestId, body.code)
          : action === "admin-reset" && typeof body.targetUserId === "string"
            ? await adminReset(req, requestId, body.targetUserId)
            : null;
    if (!result) return res.status(400).json({ error: "Invalid request.", requestId });
    return res.status(200).json({ ...result, requestId });
  } catch (error) {
    const status =
      error instanceof ApiAuthError || error instanceof ApiRateLimitError
        ? error.status
        : 500;
    if (!(error instanceof ApiAuthError) && !(error instanceof ApiRateLimitError)) {
      console.error("MFA recovery request failed", {
        requestId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
    return res.status(status).json({
      error:
        error instanceof ApiAuthError || error instanceof ApiRateLimitError
          ? error.message
          : "The security request could not be completed.",
      requestId,
    });
  }
}
