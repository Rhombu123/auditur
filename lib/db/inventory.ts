import { createAdminClient } from "../supabase/admin.js";
import type { InventoryItem, InventorySnapshot } from "../types.js";

export async function saveInventorySnapshot(
  fileName: string,
  items: InventoryItem[],
): Promise<InventorySnapshot> {
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
    fileName: upload.file_name,
    uploadedAt: upload.uploaded_at,
    items,
  };
}
