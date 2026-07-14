import { buildTodayAuditSummary } from "@/lib/audit";
import {
  demoCreateZone,
  demoDeleteUpload,
  demoDeleteVehicle,
  demoDeleteZone,
  demoExportPdfBlob,
  demoUpdateVehicle,
  demoUpdateZoneColors,
  demoUploadPdf,
  getDemoDashboard,
  getDemoInventory,
  getDemoScannedVehicles,
  getDemoZones,
  isDemoLotEnabled,
} from "@/lib/demo-store";
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
import { ZONE_COLOR_OPTIONS } from "@/lib/web-api-constants";
import type { ScannedVehicleRow } from "@/lib/web-api-types";

export { ZONE_COLOR_OPTIONS } from "@/lib/web-api-constants";
export type { ScannedVehicleRow } from "@/lib/web-api-types";

const UPLOAD_API_URL =
  process.env.NEXT_PUBLIC_UPLOAD_API_URL?.trim() ||
  process.env.EXPO_PUBLIC_UPLOAD_API_URL?.trim() ||
  "https://auditur.vercel.app/api/upload";

const EXPORT_API_URL = UPLOAD_API_URL.replace(/\/upload\/?$/, "/export-audit");

function zoneColorByIndex(index: number) {
  return ZONE_COLOR_OPTIONS[index % ZONE_COLOR_OPTIONS.length];
}

async function fetchInventory(uploadId?: string | null) {
  let uploadQuery = supabase
    .from("inventory_uploads")
    .select("id, file_name, uploaded_at")
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (uploadId) {
    const { data: byId, error } = await supabase
      .from("inventory_uploads")
      .select("id, file_name, uploaded_at")
      .eq("id", uploadId)
      .maybeSingle();
    if (error) throw error;
    if (!byId) return null;
    const { data: items, error: itemsError } = await supabase
      .from("inventory_items")
      .select("vin_suffix, model, color, days_on_lot")
      .eq("upload_id", byId.id)
      .eq("lot_status", "active")
      .order("vin_suffix", { ascending: true });
    if (itemsError) throw itemsError;
    return {
      id: byId.id as string,
      fileName: byId.file_name as string,
      uploadedAt: byId.uploaded_at as string,
      items: (items ?? []).map((row) => ({
        vinSuffix: row.vin_suffix as string,
        model: row.model as string,
        color: row.color as string,
        daysOnLot: row.days_on_lot as number | null,
      })),
    };
  }

  const { data: upload } = await uploadQuery.maybeSingle();

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
  if (isDemoLotEnabled()) return getDemoZones();
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

export async function fetchDashboardData(uploadId?: string | null): Promise<DashboardData> {
  if (isDemoLotEnabled()) {
    if (uploadId) {
      const { setDemoSelectedUpload } = await import("@/lib/demo-store");
      setDemoSelectedUpload(uploadId);
    }
    return getDemoDashboard(uploadId);
  }

  try {
    const data = await fetchLiveDashboardData(uploadId);
    const empty =
      !data.audit && data.totalPinnedVehicles === 0 && data.uploadLog.length === 0;
    if (empty) {
      const { enableDemoLot } = await import("@/lib/demo-store");
      enableDemoLot();
      return getDemoDashboard(uploadId);
    }
    return data;
  } catch {
    const { enableDemoLot } = await import("@/lib/demo-store");
    enableDemoLot();
    return getDemoDashboard(uploadId);
  }
}

async function fetchLiveDashboardData(uploadId?: string | null): Promise<DashboardData> {
  const [inventory, { data: scans, error: scansError }, uploadRows, zones] =
    await Promise.all([
      fetchInventory(uploadId),
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

  const activeId = inventory?.id ?? uploadRows.data?.[0]?.id ?? null;

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
      isCurrent: row.id === activeId,
      hasStoredPdf: Boolean(row.storage_path),
    })),
  };
}

export async function fetchInventoryList(): Promise<{
  fileName: string;
  items: InventoryItem[];
} | null> {
  if (isDemoLotEnabled()) return getDemoInventory();
  const inventory = await fetchInventory();
  if (!inventory) return null;
  return { fileName: inventory.fileName, items: inventory.items };
}

export async function fetchScannedVehicles(): Promise<ScannedVehicleRow[]> {
  if (isDemoLotEnabled()) return getDemoScannedVehicles();
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
  if (isDemoLotEnabled()) {
    demoUploadPdf(file.name);
    return;
  }
  const formData = new FormData();
  formData.append("file", file, file.name);
  const response = await fetch(UPLOAD_API_URL, { method: "POST", body: formData });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(data.error ?? "Upload failed.");
  }
}

export async function deleteInventoryUpload(uploadId: string): Promise<void> {
  if (isDemoLotEnabled()) {
    demoDeleteUpload(uploadId);
    return;
  }
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
  if (isDemoLotEnabled()) {
    const blob = demoExportPdfBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-demo-${Date.now()}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
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
  if (isDemoLotEnabled()) {
    demoUpdateVehicle(id, updates);
    return;
  }
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
  if (isDemoLotEnabled()) {
    demoDeleteVehicle(vinSuffix);
    return;
  }
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
  strokeColor?: string;
  fillColor?: string;
}): Promise<LotZone> {
  if (isDemoLotEnabled()) return demoCreateZone(input);
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
  const preset = zoneColorByIndex(input.colorIndex ?? 0);
  const fillColor = input.fillColor ?? preset.fill;
  const strokeColor = input.strokeColor ?? preset.stroke;
  const { data, error } = await supabase
    .from("lot_zones")
    .insert({
      name,
      coordinates: [newPolygon],
      fill_color: fillColor,
      stroke_color: strokeColor,
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
  if (isDemoLotEnabled()) {
    demoUpdateZoneColors(id, colors);
    return;
  }
  const { error } = await supabase
    .from("lot_zones")
    .update({ fill_color: colors.fillColor, stroke_color: colors.strokeColor })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteLotZone(id: string): Promise<void> {
  if (isDemoLotEnabled()) {
    demoDeleteZone(id);
    return;
  }
  const { error } = await supabase.from("lot_zones").delete().eq("id", id);
  if (error) throw error;
}

export type { InventoryUploadLog };
