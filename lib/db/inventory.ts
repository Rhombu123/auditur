import { createAdminClient } from "@/lib/supabase/admin";
import type { InventoryItem, InventorySnapshot } from "@/lib/types";

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

export async function getLatestInventorySnapshot(): Promise<InventorySnapshot | null> {
  const supabase = createAdminClient();

  const { data: upload, error: uploadError } = await supabase
    .from("inventory_uploads")
    .select("id, file_name, uploaded_at")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (uploadError) {
    throw uploadError;
  }

  if (!upload) {
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select("id, vin_suffix, model, color, days_on_lot, miles, year, lot_status")
    .eq("upload_id", upload.id)
    .eq("lot_status", "active")
    .order("vin_suffix", { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  return {
    fileName: upload.file_name,
    uploadedAt: upload.uploaded_at,
    items: (items ?? []).map((row) => ({
      id: row.id,
      vinSuffix: row.vin_suffix,
      model: row.model,
      color: row.color,
      daysOnLot: row.days_on_lot,
      miles: row.miles,
      year: row.year,
      lotStatus: row.lot_status,
    })),
  };
}

export async function findInventoryMatch(vinSuffix: string) {
  const inventory = await getLatestInventorySnapshot();
  if (!inventory) {
    return { inventory: null, matchedItem: null };
  }

  const normalized = vinSuffix.toUpperCase();
  const matchedItem =
    inventory.items.find((item) => item.vinSuffix.toUpperCase() === normalized) ??
    null;

  return { inventory, matchedItem };
}
