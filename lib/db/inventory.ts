import { createAdminClient } from "../supabase/admin.js";
import type { InventoryItem, InventorySnapshot } from "../types.js";

const STORAGE_BUCKET = "price-lists";

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function saveInventorySnapshot(
  fileName: string,
  items: InventoryItem[],
  pdfBuffer?: Buffer,
): Promise<InventorySnapshot & { id: string }> {
  const supabase = createAdminClient();

  const { data: upload, error: uploadError } = await supabase
    .from("inventory_uploads")
    .insert({
      file_name: fileName,
      item_count: items.length,
    })
    .select("id, file_name, uploaded_at")
    .single();

  if (uploadError || !upload) {
    throw uploadError ?? new Error("Failed to create inventory upload.");
  }

  if (pdfBuffer && pdfBuffer.length > 0) {
    const storagePath = `${upload.id}/${sanitizeFileName(fileName)}`;
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!storageError) {
      await supabase
        .from("inventory_uploads")
        .update({ storage_path: storagePath })
        .eq("id", upload.id);
    }
  }

  const rows = items.map((item) => ({
    upload_id: upload.id,
    vin_suffix: item.vinSuffix.toUpperCase(),
    model: item.model,
    color: item.color,
    days_on_lot: item.daysOnLot,
    miles: item.miles ?? null,
    year: item.year ?? null,
  }));

  const { error: itemsError } = await supabase.from("inventory_items").insert(rows);
  if (itemsError) {
    throw itemsError;
  }

  return {
    id: upload.id,
    fileName: upload.file_name,
    uploadedAt: upload.uploaded_at,
    items,
  };
}

export async function deleteInventoryUploadById(uploadId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: upload, error: fetchError } = await supabase
    .from("inventory_uploads")
    .select("storage_path")
    .eq("id", uploadId)
    .maybeSingle();

  if (fetchError) throw fetchError;

  if (upload?.storage_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([upload.storage_path]);
  }

  const { error: itemsError } = await supabase
    .from("inventory_items")
    .delete()
    .eq("upload_id", uploadId);
  if (itemsError) throw itemsError;

  const { error: uploadError } = await supabase
    .from("inventory_uploads")
    .delete()
    .eq("id", uploadId);
  if (uploadError) throw uploadError;
}
