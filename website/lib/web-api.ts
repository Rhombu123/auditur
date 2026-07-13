import { buildTodayAuditSummary } from "@/lib/audit";
import { findZoneForPoint, isScannedToday } from "@/lib/geo";
import { parseZonePolygons } from "@/lib/lot-zone-storage";
import { supabase } from "@/lib/supabase-browser";
import type { DashboardData, LotZone, ScanFeedItem, ZoneStat } from "@/lib/types";

async function fetchInventory() {
  const { data: upload } = await supabase
    .from("inventory_uploads")
    .select("id, file_name, uploaded_at")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!upload) return null;

  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("vin_suffix, model, color, days_on_lot")
    .eq("upload_id", upload.id)
    .eq("lot_status", "active")
    .order("vin_suffix", { ascending: true });

  if (error) throw error;

  return {
    fileName: upload.file_name,
    items: (items ?? []).map((row) => ({
      vinSuffix: row.vin_suffix,
      model: row.model,
      color: row.color,
      daysOnLot: row.days_on_lot,
    })),
  };
}

async function fetchZones(): Promise<LotZone[]> {
  const { data, error } = await supabase
    .from("lot_zones")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    polygons: parseZonePolygons(row.coordinates),
    fillColor: row.fill_color,
    strokeColor: row.stroke_color,
  }));
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [inventory, { data: scans, error: scansError }, uploadRows, zones] =
    await Promise.all([
      fetchInventory(),
      supabase
        .from("vehicle_scans")
        .select("id, vin_suffix, model, color, scanned_at, scanner_email, matched, latitude, longitude")
        .order("scanned_at", { ascending: false })
        .limit(200),
      supabase
        .from("inventory_uploads")
        .select("id, file_name, uploaded_at, item_count, storage_path")
        .order("uploaded_at", { ascending: false })
        .limit(8),
      fetchZones(),
    ]);

  if (scansError) throw scansError;

  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const latestByVin = new Map<string, (typeof scans)[number]>();
  for (const row of scans ?? []) {
    const key = row.vin_suffix.toUpperCase();
    if (!latestByVin.has(key)) latestByVin.set(key, row);
  }

  const audit = inventory
    ? buildTodayAuditSummary({
        inventoryFileName: inventory.fileName,
        inventoryItems: inventory.items,
        scansToday: (scans ?? []).map((row) => ({
          vinSuffix: row.vin_suffix,
          model: row.model,
          color: row.color,
          scannedAt: row.scanned_at,
          scannerEmail: row.scanner_email,
          matched: row.matched,
        })),
      })
    : null;

  const recentScans: ScanFeedItem[] = (scans ?? []).slice(0, 12).map((row) => {
    const zoneId = findZoneForPoint(
      { latitude: row.latitude, longitude: row.longitude },
      zones,
    );
    return {
      id: row.id,
      vinSuffix: row.vin_suffix,
      model: row.model ?? `Vehicle ${row.vin_suffix}`,
      color: row.color ?? "Unknown",
      scannedAt: row.scanned_at,
      scannerEmail: row.scanner_email,
      zoneName: zoneId ? zoneById.get(zoneId)?.name ?? null : null,
      matched: row.matched,
    };
  });

  const zoneVinSets = new Map<string, Set<string>>();
  for (const row of scans ?? []) {
    if (!isScannedToday(row.scanned_at)) continue;
    const zoneId = findZoneForPoint(
      { latitude: row.latitude, longitude: row.longitude },
      zones,
    );
    if (!zoneId) continue;
    const set = zoneVinSets.get(zoneId) ?? new Set<string>();
    set.add(row.vin_suffix.toUpperCase());
    zoneVinSets.set(zoneId, set);
  }

  const zoneStats: ZoneStat[] = zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    strokeColor: zone.strokeColor,
    count: zoneVinSets.get(zone.id)?.size ?? 0,
  }));

  const currentId = uploadRows.data?.[0]?.id ?? null;

  return {
    audit,
    recentScans,
    zoneStats,
    totalPinnedVehicles: latestByVin.size,
    uploadLog: (uploadRows.data ?? []).map((row) => ({
      id: row.id,
      fileName: row.file_name,
      uploadedAt: row.uploaded_at,
      itemCount: row.item_count ?? 0,
      isCurrent: row.id === currentId,
      hasStoredPdf: Boolean(row.storage_path),
    })),
  };
}
