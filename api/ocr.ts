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

async function readUploadedFile(
  req: VercelRequest,
): Promise<{ buffer: Buffer; fileName: string }> {
  const form = formidable({
    multiples: false,
    maxFileSize: 8 * 1024 * 1024,
    maxFiles: 1,
  });
  const [, files] = await form.parse(req);
  const uploaded = files.file?.[0];
  if (!uploaded?.filepath) {
    throw new Error("No image provided.");
  }

  const buffer = await fs.readFile(uploaded.filepath);
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
  const isHeif = buffer.subarray(4, 8).toString("ascii") === "ftyp";
  if (!uploaded.mimetype?.startsWith("image/") || (!isJpeg && !isPng && !isHeif)) {
    throw new Error("INVALID_IMAGE");
  }
  return {
    buffer,
    fileName: uploaded.originalFilename ?? "vin.jpg",
  };
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
    const access = await requireApiAccess(req, "scan_vehicles");
    const { requireApiRateLimit } = await import("../lib/api-rate-limit.js");
    await requireApiRateLimit(req, {
      route: "ocr",
      ...access,
      maxPerMinute: 20,
    });
    const { buffer } = await readUploadedFile(req);
    const { runOcrBuffer } = await import("../lib/ocr-handler.js");
    const result = await runOcrBuffer(buffer);
    res.status(200).json(result);
  } catch (error) {
    console.error("OCR failed", {
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
          : error instanceof Error && error.message === "INVALID_IMAGE"
            ? 400
            : 500;
    res.status(status).json({
      error:
        error instanceof ApiAuthError || error instanceof ApiRateLimitError
          ? error.message
          : status === 400
            ? "Upload a valid JPEG, PNG, or HEIF image."
            : "The image could not be processed.",
      code: error instanceof ApiAuthError ? error.code : undefined,
      requestId,
    });
  }
}
