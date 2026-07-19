import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomUUID } from "node:crypto";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = randomUUID();
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const { requireApiAccess } = await import("../lib/api-auth.js");
    const access = await requireApiAccess(req, "export_audits");
    const { requireApiRateLimit } = await import("../lib/api-rate-limit.js");
    await requireApiRateLimit(req, {
      route: "export-audit",
      ...access,
      maxPerMinute: 10,
    });
    const uploadId =
      typeof req.query.uploadId === "string" ? req.query.uploadId : undefined;
    const { runExportAuditPdf } = await import("../lib/export-audit-handler.js");
    const result = await runExportAuditPdf({ ...access, uploadId });
    const { createAdminClient } = await import("../lib/supabase/admin.js");
    const { error: auditError } = await createAdminClient()
      .from("security_audit_events")
      .insert({
        actor_user_id: access.userId,
        dealership_id: access.dealershipId,
        action: "audit_pdf_exported",
        outcome: "success",
        request_id: requestId,
      });
    if (auditError) throw auditError;

    if (result.body instanceof Buffer) {
      if (result.headers) {
        for (const [key, value] of Object.entries(result.headers)) {
          res.setHeader(key, value);
        }
      }
      res.status(result.status).send(result.body);
      return;
    }

    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Export audit failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
    });
    const { ApiAuthError } = await import("../lib/api-auth.js");
    const { ApiRateLimitError } = await import("../lib/api-rate-limit.js");
    const status =
      error instanceof ApiAuthError
        ? error.status
        : error instanceof ApiRateLimitError
          ? error.status
          : 500;
    res.status(status).json({
      error:
        error instanceof ApiAuthError || error instanceof ApiRateLimitError
          ? error.message
          : "The audit PDF could not be exported.",
      code: error instanceof ApiAuthError ? error.code : undefined,
      requestId,
    });
  }
}
