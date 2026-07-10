import type { VercelRequest, VercelResponse } from "@vercel/node";
import formidable from "formidable";
import fs from "node:fs/promises";

export const config = {
  api: {
    bodyParser: false,
  },
  maxDuration: 60,
};

async function readUploadedFile(
  req: VercelRequest,
): Promise<{ buffer: Buffer; fileName: string }> {
  const form = formidable({ multiples: false });
  const [, files] = await form.parse(req);
  const uploaded = files.file?.[0];
  if (!uploaded?.filepath) {
    throw new Error("No image provided.");
  }

  const buffer = await fs.readFile(uploaded.filepath);
  return {
    buffer,
    fileName: uploaded.originalFilename ?? "vin.jpg",
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const { buffer } = await readUploadedFile(req);
    const { runOcrBuffer } = await import("../lib/ocr-handler.js");
    const result = await runOcrBuffer(buffer);
    res.status(200).json(result);
  } catch (error) {
    console.error("OCR failed:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run OCR.",
    });
  }
}
