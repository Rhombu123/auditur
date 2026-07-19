import { randomUUID } from "node:crypto";

import type { VercelRequest, VercelResponse } from "@vercel/node";

import {
  ApiAuthError,
  requireAuthenticatedAal2,
} from "../lib/api-auth.js";
import {
  ApiRateLimitError,
  requireApiRateLimit,
} from "../lib/api-rate-limit.js";
import { createAdminClient } from "../lib/supabase/admin.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = randomUUID();
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Request-ID", requestId);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed.", requestId });
  }

  try {
    const { userId } = await requireAuthenticatedAal2(req);
    await requireApiRateLimit(req, {
      route: "delete-account",
      userId,
      maxPerMinute: 2,
    });

    const admin = createAdminClient();
    const { data: ownership, error: ownershipError } = await admin
      .from("dealership_members")
      .select("dealership_id")
      .eq("user_id", userId)
      .eq("membership_kind", "owner")
      .limit(1)
      .maybeSingle();
    if (ownershipError) throw ownershipError;
    if (ownership) {
      return res.status(409).json({
        error:
          "Transfer dealership ownership before deleting your account. Contact support if you are the only owner.",
        requestId,
      });
    }

    const { error: auditError } = await admin
      .from("security_audit_events")
      .insert({
        actor_user_id: userId,
        target_user_id: userId,
        action: "account_deleted",
        outcome: "success",
        request_id: requestId,
      });
    if (auditError) throw auditError;

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return res.status(200).json({ deleted: true, requestId });
  } catch (error) {
    const status =
      error instanceof ApiAuthError || error instanceof ApiRateLimitError
        ? error.status
        : 500;
    if (!(error instanceof ApiAuthError) && !(error instanceof ApiRateLimitError)) {
      console.error("Account deletion failed", {
        requestId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    }
    return res.status(status).json({
      error:
        error instanceof ApiAuthError || error instanceof ApiRateLimitError
          ? error.message
          : "The account could not be deleted.",
      code: error instanceof ApiAuthError ? error.code : undefined,
      requestId,
    });
  }
}
