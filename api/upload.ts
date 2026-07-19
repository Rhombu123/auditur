import type { VercelRequest, VercelResponse } from "@vercel/node";
import formidable from "formidable";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

class UploadInputError extends Error {
  readonly status = 400;
}

async function readUploadedFile(
  req: VercelRequest,
): Promise<{ buffer: Buffer; fileName: string }> {
  const form = formidable({
    multiples: false,
    maxFileSize: 10 * 1024 * 1024,
    maxFiles: 1,
  });
  const [, files] = await form.parse(req);
  const uploaded = files.file?.[0];
  if (!uploaded?.filepath) {
    throw new UploadInputError("No audit file provided.");
  }

  const buffer = await fs.readFile(uploaded.filepath);
  const mimeType = (uploaded.mimetype ?? "").toLowerCase();
  const fileName = uploaded.originalFilename ?? "inventory.pdf";
  const extension = fileName.toLowerCase().split(".").at(-1);
  const looksLikePdf =
    buffer.subarray(0, 5).equals(Buffer.from("%PDF-")) ||
    buffer.subarray(0, 4).toString("utf8") === "%PDF";
  const looksLikeCsv =
    (extension === "csv" ||
      mimeType === "text/csv" ||
      mimeType === "application/csv" ||
      mimeType === "application/vnd.ms-excel" ||
      mimeType === "text/comma-separated-values") &&
    !buffer.includes(0);
  if (!looksLikePdf && !looksLikeCsv) {
    throw new UploadInputError("Upload a valid PDF or UTF-8 CSV file.");
  }
  return {
    buffer,
    fileName,
  };
}

function publicErrorMessage(error: unknown, status: number): string {
  if (status === 400) {
    return error instanceof Error
      ? error.message
      : "Upload a valid PDF or CSV file.";
  }
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const message = (error as { message: string }).message;
    if (
      message.length > 0 &&
      message.length <= 240 &&
      !/service role|secret key|supabase url|anon key/i.test(message)
    ) {
      return message;
    }
  }
  return "The upload could not be processed.";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const requestId = randomUUID();
  res.setHeader("X-Request-ID", requestId);
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const { requireApiAccess } = await import("../lib/api-auth.js");
    const access = await requireApiAccess(req, "manage_uploads");
    const { requireApiRateLimit } = await import("../lib/api-rate-limit.js");
    await requireApiRateLimit(req, {
      route: "upload",
      ...access,
      maxPerMinute: 6,
    });
    const { buffer, fileName } = await readUploadedFile(req);
    const { runUploadBuffer } = await import("../lib/upload-handler.js");
    const result = await runUploadBuffer(buffer, fileName, access);
    res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Upload failed", {
      requestId,
      errorName: error instanceof Error ? error.name : "UnknownError",
      errorMessage: error instanceof Error ? error.message : undefined,
    });
    const { ApiAuthError } = await import("../lib/api-auth.js");
    const { ApiRateLimitError } = await import("../lib/api-rate-limit.js");
    const status =
      error instanceof ApiAuthError
        ? error.status
        : error instanceof ApiRateLimitError
          ? error.status
          : error instanceof UploadInputError
            ? error.status
            : 500;
    res.status(status).json({
      error: publicErrorMessage(error, status),
      code: error instanceof ApiAuthError ? error.code : undefined,
      requestId,
    });
  }
}
