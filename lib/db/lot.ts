import { createAdminClient } from "@/lib/supabase/admin";
import type { LotStatus, LotVehicle } from "@/lib/types";

function isScannedToday(scannedAt: string): boolean {
  const scanned = new Date(scannedAt);
  const now = new Date();

  return (
    scanned.getFullYear() === now.getFullYear() &&
    scanned.getMonth() === now.getMonth() &&
    scanned.getDate() === now.getDate()
  );
}

export async function getActiveLotVehicles(): Promise<LotVehicle[]> {
  const supabase = createAdminClient();

  const { data: upload, error: uploadError } = await supabase
    .from("inventory_uploads")
    .select("id")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (uploadError) {
    throw uploadError;
  }

  if (!upload) {
    return [];
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

  const { data: scans, error: scansError } = await supabase
    .from("vehicle_scans")
    .select("vin_suffix, latitude, longitude, scanned_at")
    .order("scanned_at", { ascending: false });

  if (scansError) {
    throw scansError;
  }

  const latestScanByVin = new Map<
    string,
    { latitude: number; longitude: number; scannedAt: string }
  >();

  for (const scan of scans ?? []) {
    const key = scan.vin_suffix.toUpperCase();
    if (!latestScanByVin.has(key)) {
      latestScanByVin.set(key, {
        latitude: scan.latitude,
        longitude: scan.longitude,
        scannedAt: scan.scanned_at,
      });
    }
  }

  return (items ?? []).map((item) => {
    const scan = latestScanByVin.get(item.vin_suffix.toUpperCase()) ?? null;

    return {
      id: item.id,
      vinSuffix: item.vin_suffix,
      model: item.model,
      color: item.color,
      daysOnLot: item.days_on_lot,
      miles: item.miles,
      year: item.year,
      latitude: scan?.latitude ?? null,
      longitude: scan?.longitude ?? null,
      lastScannedAt: scan?.scannedAt ?? null,
      scannedToday: scan ? isScannedToday(scan.scannedAt) : false,
      lotStatus: item.lot_status as LotStatus,
    };
  });
}

export async function markVehicleLotStatus(
  itemId: string,
  lotStatus: Exclude<LotStatus, "active">,
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("inventory_items")
    .update({
      lot_status: lotStatus,
      removed_at: new Date().toISOString(),
    })
    .eq("id", itemId)
    .eq("lot_status", "active");

  if (error) {
    throw error;
  }
}
