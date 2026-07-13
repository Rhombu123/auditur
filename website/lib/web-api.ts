import { buildTodayAuditSummary } from "@/lib/audit";
import { findZoneForPoint, isScannedToday } from "@/lib/geo";
import {
  normalizeZoneName,
  parseZonePolygons,
  serializeZonePolygons,
} from "@/lib/lot-zone-storage";
import { supabase } from "@/lib/supabase-browser";
import type {
  DashboardData,
  InventoryItem,
  InventoryUploadLog,
  LotZone,
  ScanFeedItem,
  ZoneStat,
} from "@/lib/types";

export type ScannedVehicleRow = {
  id: string;
  vinSuffix: string;
  model: string;
  color: string;
  scannedAt: string;
  latitude: number;
  longitude: number;
  matched: boolean;
  scannerEmail: string | null;
};

const UPLOAD_API_URL =
  process.env.NEXT_PUBLIC_UPLOAD_API_URL?.trim() ||
  process.env.EXPO_PUBLIC_UPLOAD_API_URL?.trim() ||
  "https://auditur.vercel.app/api/upload";

const EXPORT_API_URL = UPLOAD_API_URL.replace(/\/upload\/?$/, "/export-audit");

export const ZONE_COLOR_OPTIONS = [
  { id: "teal", label: "Teal", fill: "rgba(13, 148, 136, 0.35)", stroke: "#0D9488" },
  { id: "blue", label: "Blue", fill: "rgba(59, 130, 246, 0.35)", stroke: "#3B82F6" },
  { id: "amber", label: "Amber", fill: "rgba(245, 158, 11, 0.35)", stroke: "#F59E0B" },
  { id: "violet", label: "Violet", fill: "rgba(139, 92, 246, 0.35)", stroke: "#8B5CF6" },
  { id: "rose", label: "Rose", fill: "rgba(244, 63, 94, 0.35)", stroke: "#F43F5E" },
  { id: "green", label: "Green", fill: "rgba(34, 197, 94, 0.35)", stroke: "#22C55E" },
  { id: "orange", label: "Orange", fill: "rgba(249, 115, 22, 0.35)", stroke: "#F97316" },
  { id: "slate", label: "Slate", fill: "rgba(100, 116, 139, 0.35)", stroke: "#64748B" },
] as const;

function zoneColorByIndex(index: number) {
  return ZONE_COLOR_OPTIONS[index % ZONE_COLOR_OPTIONS.length];
}

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
    id: upload.id as string,
    fileName: upload.file_name as string,
    uploadedAt: upload.uploaded_at as string,
    items: (items ?? []).map((row) => ({
      vinSuffix: row.vin_suffix as string,
      model: row.model as string,
      color: row.color as string,
      daysOnLot: row.days_on_lot as number | null,
    })),
  };
}

export async function fetchZones(): Promise<LotZone[]> {
  const { data, error } = await supabase
    .from("lot_zones")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    polygons: parseZonePolygons(row.coordinates),
    fillColor: row.fill_color as string,
    strokeColor: row.stroke_color as string,
  }));
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const [inventory, { data: scans, error: scansError }, uploadRows, zones] =
    await Promise.all([
      fetchInventory(),
      supabase
        .from("vehicle_scans")
        .select(
          "id, vin_suffix, model, color, scanned_at, scanner_email, matched, latitude, longitude",
        )
        .order("scanned_at", { ascending: false })
        .limit(200),
      supabase
        .from("inventory_uploads")
        .select("id, file_name, uploaded_at, item_count, storage_path")
        .order("uploaded_at", { ascending: false })
        .limit(25),
      fetchZones(),
    ]);

  if (scansError) throw scansError;

  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const latestByVin = new Map<string, (typeof scans)[number]>();
  for (const row of scans ?? []) {
    const key = (row.vin_suffix as string).toUpperCase();
    if (!latestByVin.has(key)) latestByVin.set(key, row);
  }

  const audit = inventory
    ? buildTodayAuditSummary({
        inventoryFileName: inventory.fileName,
        inventoryItems: inventory.items,
        scansToday: (scans ?? []).map((row) => ({
          vinSuffix: row.vin_suffix as string,
          model: row.model as string,
          color: row.color as string,
          scannedAt: row.scanned_at as string,
          scannerEmail: row.scanner_email as string | null,
          matched: row.matched as boolean,
        })),
      })
    : null;

  const recentScans: ScanFeedItem[] = (scans ?? []).slice(0, 12).map((row) => {
    const zoneId = findZoneForPoint(
      { latitude: row.latitude as number, longitude: row.longitude as number },
      zones,
    );
    return {
      id: row.id as string,
      vinSuffix: row.vin_suffix as string,
      model: (row.model as string) ?? `Vehicle ${row.vin_suffix}`,
      color: (row.color as string) ?? "Unknown",
      scannedAt: row.scanned_at as string,
      scannerEmail: row.scanner_email as string | null,
      zoneName: zoneId ? (zoneById.get(zoneId)?.name ?? null) : null,
      matched: row.matched as boolean,
    };
  });

  const zoneVinSets = new Map<string, Set<string>>();
  for (const row of scans ?? []) {
    if (!isScannedToday(row.scanned_at as string)) continue;
    const zoneId = findZoneForPoint(
      { latitude: row.latitude as number, longitude: row.longitude as number },
      zones,
    );
    if (!zoneId) continue;
    const set = zoneVinSets.get(zoneId) ?? new Set<string>();
    set.add((row.vin_suffix as string).toUpperCase());
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
      id: row.id as string,
      fileName: row.file_name as string,
      uploadedAt: row.uploaded_at as string,
      itemCount: (row.item_count as number) ?? 0,
      isCurrent: row.id === currentId,
      hasStoredPdf: Boolean(row.storage_path),
    })),
  };
}

export async function fetchInventoryList(): Promise<{
  fileName: string;
  items: InventoryItem[];
} | null> {
  const inventory = await fetchInventory();
  if (!inventory) return null;
  return { fileName: inventory.fileName, items: inventory.items };
}

export async function fetchScannedVehicles(): Promise<ScannedVehicleRow[]> {
  const { data, error } = await supabase
    .from("vehicle_scans")
    .select("id, vin_suffix, model, color, scanned_at, latitude, longitude, matched, scanner_email")
    .order("scanned_at", { ascending: false });
  if (error) throw error;

  const latest = new Map<string, ScannedVehicleRow>();
  for (const row of data ?? []) {
    const key = (row.vin_suffix as string).toUpperCase();
    if (latest.has(key)) continue;
    latest.set(key, {
      id: row.id as string,
      vinSuffix: row.vin_suffix as string,
      model: (row.model as string) ?? `Vehicle ${row.vin_suffix}`,
      color: (row.color as string) ?? "Unknown",
      scannedAt: row.scanned_at as string,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      matched: row.matched as boolean,
      scannerEmail: row.scanner_email as string | null,
    });
  }
  return Array.from(latest.values());
}

export async function uploadInventoryPdf(file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file, file.name);
  const response = await fetch(UPLOAD_API_URL, { method: "POST", body: formData });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Upload failed.");
  }
}

export async function deleteInventoryUpload(uploadId: string): Promise<void> {
  const { data: upload, error: fetchError } = await supabase
    .from("inventory_uploads")
    .select("storage_path")
    .eq("id", uploadId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  if (upload?.storage_path) {
    const { error: storageError } = await supabase.storage
      .from("price-lists")
      .remove([upload.storage_path as string]);
    if (storageError) throw storageError;
  }

  const { error: itemsError } = await supabase
    .from("inventory_items")
    .delete()
    .eq("upload_id", uploadId);
  if (itemsError) throw itemsError;

  const { error } = await supabase.from("inventory_uploads").delete().eq("id", uploadId);
  if (error) throw error;
}

export async function exportHighlightedAuditPdf(): Promise<void> {
  const response = await fetch(EXPORT_API_URL);
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Export failed.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-highlighted-${Date.now()}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function updateScannedVehicle(
  id: string,
  updates: { model: string; color: string },
): Promise<void> {
  const { data: row, error: fetchError } = await supabase
    .from("vehicle_scans")
    .select("vin_suffix")
    .eq("id", id)
    .single();
  if (fetchError || !row) throw fetchError ?? new Error("Vehicle not found.");

  const { error } = await supabase
    .from("vehicle_scans")
    .update({ model: updates.model, color: updates.color })
    .eq("vin_suffix", row.vin_suffix);
  if (error) throw error;
}

export async function deleteScannedVehicleByVinSuffix(vinSuffix: string): Promise<void> {
  const normalized = vinSuffix.trim().toUpperCase();
  const { data: matches, error: listError } = await supabase
    .from("vehicle_scans")
    .select("id")
    .ilike("vin_suffix", normalized);
  if (listError) throw listError;
  const ids = (matches ?? []).map((row) => row.id as string);
  if (ids.length === 0) throw new Error("Vehicle not found.");
  const { error } = await supabase.from("vehicle_scans").delete().in("id", ids);
  if (error) throw error;
}

export async function createLotZone(input: {
  name: string;
  coordinates: { latitude: number; longitude: number }[];
  colorIndex?: number;
}): Promise<LotZone> {
  const name = input.name.trim();
  const newPolygon = serializeZonePolygons([input.coordinates])[0];
  if (!newPolygon) throw new Error("Draw at least 3 corners before saving.");

  const { data: existingRows, error: listError } = await supabase
    .from("lot_zones")
    .select("*")
    .order("created_at", { ascending: true });
  if (listError) throw listError;

  const normalized = normalizeZoneName(name);
  const existing = (existingRows ?? []).find(
    (row) => normalizeZoneName(row.name as string) === normalized,
  );

  if (existing) {
    const existingPolygons = parseZonePolygons(existing.coordinates);
    const merged = serializeZonePolygons([...existingPolygons, newPolygon]);
    const { data, error } = await supabase
      .from("lot_zones")
      .update({ coordinates: merged })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error || !data) throw error ?? new Error("Could not update zone.");
    return {
      id: data.id as string,
      name: data.name as string,
      polygons: parseZonePolygons(data.coordinates),
      fillColor: data.fill_color as string,
      strokeColor: data.stroke_color as string,
    };
  }

  const { data: authData } = await supabase.auth.getUser();
  const colors = zoneColorByIndex(input.colorIndex ?? 0);
  const { data, error } = await supabase
    .from("lot_zones")
    .insert({
      name,
      coordinates: [newPolygon],
      fill_color: colors.fill,
      stroke_color: colors.stroke,
      created_by: authData.user?.id ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw error ?? new Error("Could not save zone.");
  return {
    id: data.id as string,
    name: data.name as string,
    polygons: parseZonePolygons(data.coordinates),
    fillColor: data.fill_color as string,
    strokeColor: data.stroke_color as string,
  };
}

export async function updateLotZoneColors(
  id: string,
  colors: { fillColor: string; strokeColor: string },
): Promise<void> {
  const { error } = await supabase
    .from("lot_zones")
    .update({ fill_color: colors.fillColor, stroke_color: colors.strokeColor })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLotZone(id: string): Promise<void> {
  const { error } = await supabase.from("lot_zones").delete().eq("id", id);
  if (error) throw error;
}

export type { InventoryUploadLog };
