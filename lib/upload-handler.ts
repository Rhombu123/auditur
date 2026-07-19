import { saveInventorySnapshot } from "./db/inventory.js";
import {
  importInventoryBuffer,
  InventoryImportError,
} from "./inventory-import.js";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

export async function runUploadBuffer(
  buffer: Buffer,
  fileName: string,
  access: { dealershipId: string; userId: string; accessToken?: string },
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return {
      status: 400,
      body: { error: "File is too large. Maximum size is 10 MB." },
    };
  }

  let result;
  try {
    result = await importInventoryBuffer(buffer, fileName);
  } catch (error) {
    if (error instanceof InventoryImportError) {
      return {
        status: error.status,
        body: { error: error.message, ...error.details },
      };
    }
    throw error;
  }

  const inventory = await saveInventorySnapshot(
    fileName,
    result.items,
    access,
    {
      buffer,
      contentType: result.contentType,
      fileFormat: result.fileFormat,
      sourceSystem: result.sourceSystem,
      importMethod: result.importMethod,
      parserMetadata: result.parserMetadata,
      warnings: result.warnings,
    },
  );

  return {
    status: 200,
    body: {
      fileName: inventory.fileName,
      uploadedAt: inventory.uploadedAt,
      itemCount: inventory.items.length,
      items: inventory.items,
      uploadId: inventory.id,
      fileFormat: result.fileFormat,
      sourceSystem: result.sourceSystem,
      importMethod: result.importMethod,
      detectedColumns: result.detectedColumns,
      warnings: result.warnings,
      parserMetadata: result.parserMetadata,
    },
  };
}
