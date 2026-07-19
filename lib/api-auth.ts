import type { VercelRequest } from "@vercel/node";

import { createUserClient, getSupabaseUrl } from "./supabase/server-client.js";

export type ApiPermission =
  | "manage_uploads"
  | "export_audits"
  | "scan_vehicles"
  | "manage_members";

export class ApiAuthError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403,
    readonly code:
      | "AUTH_REQUIRED"
      | "SESSION_INVALID"
      | "EMAIL_UNVERIFIED"
      | "MFA_REQUIRED"
      | "DEALERSHIP_REQUIRED"
      | "FORBIDDEN" = "FORBIDDEN",
  ) {
    super(message);
  }
}

function headerValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function readJwtClaim(token: string, claim: string): unknown {
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = Buffer.from(normalized, "base64").toString("utf8");
    return JSON.parse(json)?.[claim] ?? null;
  } catch {
    return null;
  }
}

export async function requireApiAccess(
  req: VercelRequest,
  permission: ApiPermission,
): Promise<{ userId: string; dealershipId: string; accessToken: string }> {
  const { userId, token } = await requireAuthenticatedAal2(req);
  const dealershipId = headerValue(
    req.headers["x-auditur-dealership-id"],
  ).trim();
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      dealershipId,
    )
  ) {
    throw new ApiAuthError("A valid dealership is required.", 403, "DEALERSHIP_REQUIRED");
  }

  const client = createUserClient(token);
  const { data, error } = await client.rpc("get_my_dealership_access");
  if (error) {
    throw new ApiAuthError("Could not verify dealership access.", 403);
  }

  const membership = ((data ?? []) as Array<Record<string, unknown>>).find(
    (row) => String(row.dealership_id) === dealershipId,
  );
  if (!membership) {
    throw new ApiAuthError("You do not have access to this dealership.", 403);
  }

  const permissions = Array.isArray(membership.permissions)
    ? membership.permissions.map(String)
    : [];
  const isOwner = membership.membership_kind === "owner";
  if (!isOwner && !permissions.includes(permission)) {
    throw new ApiAuthError("Your role does not allow this action.", 403);
  }

  return { userId, dealershipId, accessToken: token };
}

export async function requireAuthenticatedAal2(
  req: VercelRequest,
): Promise<{ userId: string; token: string }> {
  const authorization = headerValue(req.headers.authorization);
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) {
    throw new ApiAuthError("Authentication required.", 401, "AUTH_REQUIRED");
  }

  const client = createUserClient(token);
  const { data: authData, error: authError } = await client.auth.getUser(token);
  if (authError || !authData.user) {
    throw new ApiAuthError("Your session is invalid or expired.", 401, "SESSION_INVALID");
  }

  const expectedIssuer = `${getSupabaseUrl().replace(/\/$/, "")}/auth/v1`;
  const issuer = readJwtClaim(token, "iss");
  const audience = readJwtClaim(token, "aud");
  const expiresAt = Number(readJwtClaim(token, "exp") ?? 0);
  const audiences = Array.isArray(audience) ? audience : [audience];
  if (
    expiresAt * 1000 <= Date.now() ||
    issuer !== expectedIssuer ||
    !audiences.includes("authenticated")
  ) {
    throw new ApiAuthError("Your session is invalid or expired.", 401, "SESSION_INVALID");
  }
  if (!authData.user.email_confirmed_at) {
    throw new ApiAuthError("Confirm your email before continuing.", 403, "EMAIL_UNVERIFIED");
  }
  if (readJwtClaim(token, "aal") !== "aal2") {
    throw new ApiAuthError(
      "Multi-factor authentication is required.",
      403,
      "MFA_REQUIRED",
    );
  }

  return { userId: authData.user.id, token };
}
