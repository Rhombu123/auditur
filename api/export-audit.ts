import type { VercelRequest, VercelResponse } from "@vercel/node";

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const { runExportAuditPdf } = await import("../lib/export-audit-handler.js");
    const result = await runExportAuditPdf();

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
    console.error("Export audit failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to export audit PDF.",
    });
  }
}
