import { NextResponse } from "next/server";

import { saveInventorySnapshot } from "@/lib/db/inventory";
import { extractPdfText } from "@/lib/extract-pdf-text";
import { parseInventoryText } from "@/lib/parse-inventory";

export const runtime = "nodejs";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isPdfFile(file: File): boolean {
  const normalizedName = file.name.toLowerCase();
  const normalizedType = file.type.toLowerCase();

  return (
    normalizedName.endsWith(".pdf") ||
    normalizedType === "application/pdf" ||
    normalizedType === "application/octet-stream" ||
    normalizedType === "application/x-pdf" ||
    normalizedType === "binary/octet-stream" ||
    normalizedType === ""
  );
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No PDF file provided." },
        { status: 400 },
      );
    }

    if (!isPdfFile(file)) {
      return NextResponse.json(
        { error: "Only PDF files are supported." },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Maximum size is 10 MB." },
        { status: 400 },
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "The selected file is empty." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractPdfText(buffer);
    const result = parseInventoryText(text);

    if (result.items.length === 0) {
      return NextResponse.json(
        {
          error:
            "No inventory records found. The PDF may use a format we cannot parse yet.",
          rawTextPreview: result.rawTextPreview,
          totalLines: result.totalLines,
        },
        { status: 422 },
      );
    }

    const inventory = await saveInventorySnapshot(file.name, result.items);

    return NextResponse.json({
      fileName: inventory.fileName,
      uploadedAt: inventory.uploadedAt,
      itemCount: inventory.items.length,
      items: inventory.items,
      totalLines: result.totalLines,
    });
  } catch (error) {
    console.error("PDF upload failed:", error);
    return NextResponse.json(
      { error: "Failed to process the PDF. Please try another file." },
      { status: 500 },
    );
  }
}
