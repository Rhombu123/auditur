import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createAdminClient,
  createUserClient,
  hasServiceRoleKey,
} from "../supabase/admin.js";
import type {
  ImportFileFormat,
  ImportMethod,
  InventoryItem,
  InventorySnapshot,
} from "../types.js";

const STORAGE_BUCKET = "price-lists";

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function inventoryClient(accessToken?: string): SupabaseClient {
  if (accessToken) {
    return createUserClient(accessToken);
  }
  if (hasServiceRoleKey()) {
    return createAdminClient();
  }
  throw new Error(
    "Upload storage is not configured. Set SUPABASE_SERVICE_ROLE_KEY or pass a user access token.",
  );
}

export async function saveInventorySnapshot(
  fileName: string,
  items: InventoryItem[],
  access: { dealershipId: string; userId: string; accessToken?: string },
  originalFile?: {
    buffer: Buffer;
    contentType: "application/pdf" | "text/csv";
    fileFormat: ImportFileFormat;
    sourceSystem: string;
    importMethod: ImportMethod;
    parserMetadata: Record<string, unknown>;
    warnings: string[];
  },
): Promise<InventorySnapshot & { id: string }> {
  const supabase = inventoryClient(access.accessToken);
  const uploadId = randomUUID();
  const storagePath =
    originalFile?.buffer.length
      ? `${access.dealershipId}/${uploadId}/${sanitizeFileName(fileName)}`
      : null;

  if (storagePath && originalFile) {
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, originalFile.buffer, {
        contentType: originalFile.contentType,
        upsert: false,
      });

    if (storageError) {
      throw new Error(
        `Could not store the original audit file: ${storageError.message}`,
      );
    }
  }

  const rows = items.map((item) => ({
    vin: item.vin ?? null,
    vin_suffix: item.vinSuffix.toUpperCase(),
    stock_number: item.stockNumber ?? null,
    make: item.make ?? null,
    model: item.model,
    color: item.color,
    source_status: item.sourceStatus ?? null,
    days_on_lot: item.daysOnLot,
    miles: item.miles ?? null,
    year: item.year ?? null,
  }));

  const { error: activationError } = await supabase.rpc(
    "activate_inventory_import",
    {
      target_upload_id: uploadId,
      target_dealership_id: access.dealershipId,
      target_created_by: access.userId,
      target_file_name: fileName,
      target_storage_path: storagePath,
      target_file_format: originalFile?.fileFormat ?? "pdf",
      target_source_system: originalFile?.sourceSystem ?? "unknown",
      target_import_method: originalFile?.importMethod ?? "manual",
      target_parser_metadata: originalFile?.parserMetadata ?? {},
      target_import_warnings: originalFile?.warnings ?? [],
      target_items: rows,
    },
  );

  if (activationError) {
    if (storagePath) {
      await supabase.storage.from(STORAGE_BUCKET).remove([storagePath]);
    }
    throw activationError;
  }

  const { data: upload, error: uploadError } = await supabase
    .from("inventory_uploads")
    .select(
      "id, file_name, uploaded_at, file_format, source_system, import_method, parser_metadata, import_warnings",
    )
    .eq("id", uploadId)
    .eq("dealership_id", access.dealershipId)
    .single();
  if (uploadError || !upload) {
    throw (
      uploadError ?? new Error("Import activated without a readable upload.")
    );
  }

  return {
    id: upload.id,
    fileName: upload.file_name,
    uploadedAt: upload.uploaded_at,
    items,
    fileFormat: upload.file_format,
    sourceSystem: upload.source_system,
    importMethod: upload.import_method,
    parserMetadata: upload.parser_metadata,
    warnings: upload.import_warnings,
  };
}

export async function deleteInventoryUploadById(
  uploadId: string,
  dealershipId: string,
  accessToken?: string,
): Promise<void> {
  const supabase = inventoryClient(accessToken);

  const { data: upload, error: fetchError } = await supabase
    .from("inventory_uploads")
    .select("storage_path")
    .eq("id", uploadId)
    .eq("dealership_id", dealershipId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  const { error: uploadError } = await supabase.rpc("delete_inventory_upload", {
    target_upload_id: uploadId,
  });
  if (uploadError) throw uploadError;

  if (upload?.storage_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([upload.storage_path]);
  }
}
