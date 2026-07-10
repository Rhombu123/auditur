import { saveInventorySnapshot } from "./db/inventory.js";
import { extractPdfText } from "./extract-pdf-text.js";
import { parseInventoryText } from "./parse-inventory.js";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isPdfFile(fileName: string, buffer: Buffer): boolean {
  const normalizedName = fileName.toLowerCase();
  return (
    normalizedName.endsWith(".pdf") ||
    buffer.subarray(0, 4).toString() === "%PDF"
  );
}

export async function runUploadBuffer(
  buffer: Buffer,
  fileName: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!isPdfFile(fileName, buffer)) {
    return { status: 400, body: { error: "Only PDF files are supported." } };
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      status: 400,
      body: { error: "File is too large. Maximum size is 10 MB." },
    };
  }

  if (buffer.length === 0) {
    return { status: 400, body: { error: "The selected file is empty." } };
  }

  const text = await extractPdfText(buffer);
  const result = parseInventoryText(text);

  if (result.items.length === 0) {
    return {
      status: 422,
      body: {
        error:
          "No inventory records found. The PDF may use a format we cannot parse yet.",
        rawTextPreview: result.rawTextPreview,
        totalLines: result.totalLines,
      },
    };
  }

  const inventory = await saveInventorySnapshot(fileName, result.items);

  return {
    status: 200,
    body: {
      fileName: inventory.fileName,
      uploadedAt: inventory.uploadedAt,
      itemCount: inventory.items.length,
      items: inventory.items,
    },
  };
}
