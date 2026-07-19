import { buildTodayAuditSummary } from "@/lib/audit";
import { requireApiDealershipId } from "@/lib/active-dealership";
import {
  demoCreateZone,
  demoDeleteUpload,
  demoDeleteZone,
  demoUpdateVehicle,
  demoUpdateZoneColors,
  demoUploadAuditFile,
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
  InventoryImportSummary,
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
  "/api/upload";

const EXPORT_API_URL = `${UPLOAD_API_URL.replace(
  /\/upload\/?$/,
  "/export-audit",
).replace(/\/$/, "")}/`;
let demoUploadedPdf: File | null = null;

function zoneColorByIndex(index: number) {
  return ZONE_COLOR_OPTIONS[index % ZONE_COLOR_OPTIONS.length];
}

async function fetchInventory(uploadId?: string | null) {
  const dealershipId = requireApiDealershipId();
  let uploadQuery = supabase
    .from("inventory_uploads")
    .select(
      "id, file_name, uploaded_at, file_format, source_system, import_method, parser_metadata, import_warnings",
    )
    .eq("dealership_id", dealershipId)
    .is("archived_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (uploadId) {
    const { data: byId, error } = await supabase
      .from("inventory_uploads")
      .select(
        "id, file_name, uploaded_at, file_format, source_system, import_method, parser_metadata, import_warnings",
      )
      .eq("id", uploadId)
      .eq("dealership_id", dealershipId)
      .maybeSingle();
    if (error) throw error;
    if (!byId) return null;
    const { data: items, error: itemsError } = await supabase
      .from("inventory_items")
      .select(
        "id, vin, vin_suffix, stock_number, make, model, color, source_status, days_on_lot, miles, year",
      )
      .eq("dealership_id", dealershipId)
      .eq("upload_id", byId.id)
      .eq("lot_status", "active")
      .order("vin_suffix", { ascending: true });
    if (itemsError) throw itemsError;
    return {
      id: byId.id as string,
      fileName: byId.file_name as string,
      uploadedAt: byId.uploaded_at as string,
      fileFormat: byId.file_format,
      sourceSystem: byId.source_system,
      importMethod: byId.import_method,
      parserMetadata: byId.parser_metadata,
      warnings: byId.import_warnings,
      items: (items ?? []).map((row) => ({
        id: row.id as string,
        vin: row.vin as string | null,
        vinSuffix: row.vin_suffix as string,
        stockNumber: row.stock_number as string | null,
        make: row.make as string | null,
        model: row.model as string,
        color: row.color as string,
        sourceStatus: row.source_status as string | null,
        daysOnLot: row.days_on_lot as number | null,
        miles: row.miles as number | null,
        year: row.year as number | null,
      })),
    };
  }

  const { data: upload } = await uploadQuery.maybeSingle();

  if (!upload) return null;

  const { data: items, error } = await supabase
    .from("inventory_items")
    .select(
      "id, vin, vin_suffix, stock_number, make, model, color, source_status, days_on_lot, miles, year",
    )
    .eq("dealership_id", dealershipId)
    .eq("upload_id", upload.id)
    .eq("lot_status", "active")
    .order("vin_suffix", { ascending: true });

  if (error) throw error;

  return {
    id: upload.id as string,
    fileName: upload.file_name as string,
    uploadedAt: upload.uploaded_at as string,
    fileFormat: upload.file_format,
    sourceSystem: upload.source_system,
    importMethod: upload.import_method,
    parserMetadata: upload.parser_metadata,
    warnings: upload.import_warnings,
    items: (items ?? []).map((row) => ({
      id: row.id as string,
      vin: row.vin as string | null,
      vinSuffix: row.vin_suffix as string,
      stockNumber: row.stock_number as string | null,
      make: row.make as string | null,
      model: row.model as string,
      color: row.color as string,
      sourceStatus: row.source_status as string | null,
      daysOnLot: row.days_on_lot as number | null,
      miles: row.miles as number | null,
      year: row.year as number | null,
    })),
  };
}

export async function fetchZones(): Promise<LotZone[]> {
  if (isDemoLotEnabled()) return getDemoZones();
  const dealershipId = requireApiDealershipId();
  const { data, error } = await supabase
    .from("lot_zones")
    .select("*")
    .eq("dealership_id", dealershipId)
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

  return fetchLiveDashboardData(uploadId);
}

async function fetchLiveDashboardData(uploadId?: string | null): Promise<DashboardData> {
  const dealershipId = requireApiDealershipId();
  const [inventory, { data: scans, error: scansError }, uploadRows, zones, usageRows] =
    await Promise.all([
      fetchInventory(uploadId),
      supabase
        .from("vehicle_scans")
        .select(
          "id, vin_suffix, model, color, scanned_at, scanner_email, matched, latitude, longitude",
        )
        .eq("dealership_id", dealershipId)
        .order("scanned_at", { ascending: false })
        .limit(200),
      supabase
        .from("inventory_uploads")
        .select(
          "id, file_name, uploaded_at, item_count, storage_path, archived_at, file_format, source_system, import_method, parser_metadata, import_warnings",
        )
        .eq("dealership_id", dealershipId)
        .order("uploaded_at", { ascending: false })
        .limit(25),
      fetchZones(),
      supabase
        .from("vehicle_scans")
        .select("inventory_upload_id, scanned_at")
        .eq("dealership_id", dealershipId)
        .not("inventory_upload_id", "is", null)
        .order("scanned_at", { ascending: false })
        .limit(10000),
    ]);

  if (scansError) throw scansError;
  if (usageRows.error) throw usageRows.error;

  const { data: auditScans, error: auditScansError } = inventory
    ? await supabase
        .from("vehicle_scans")
        .select("vin_suffix, model, color, scanned_at, scanner_email, matched")
        .eq("dealership_id", dealershipId)
        .eq("inventory_upload_id", inventory.id)
        .order("scanned_at", { ascending: false })
    : { data: [], error: null };

  if (auditScansError) throw auditScansError;

  const zoneById = new Map(zones.map((z) => [z.id, z]));
  const latestByVin = new Map<string, (typeof scans)[number]>();
  for (const row of scans ?? []) {
    const key = (row.vin_suffix as string).toUpperCase();
    if (!latestByVin.has(key)) latestByVin.set(key, row);
  }

  const audit = inventory
    ? {
        ...buildTodayAuditSummary({
        inventoryFileName: inventory.fileName,
        inventoryItems: inventory.items,
        scansToday: (auditScans ?? []).map((row) => ({
          vinSuffix: row.vin_suffix as string,
          model: row.model as string,
          color: row.color as string,
          scannedAt: row.scanned_at as string,
          scannerEmail: row.scanner_email as string | null,
          matched: row.matched as boolean,
        })),
        }),
        fileFormat: inventory.fileFormat,
        sourceSystem: inventory.sourceSystem,
        warnings: inventory.warnings,
      }
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

  const activeId =
    inventory?.id ??
    uploadRows.data?.find((row) => row.archived_at == null)?.id ??
    null;
  const usageByUpload = new Map<string, { scanCount: number; lastUsedAt: string }>();
  for (const row of usageRows.data ?? []) {
    const uploadId = row.inventory_upload_id as string | null;
    if (!uploadId) continue;
    const current = usageByUpload.get(uploadId);
    usageByUpload.set(uploadId, {
      scanCount: (current?.scanCount ?? 0) + 1,
      lastUsedAt: current?.lastUsedAt ?? (row.scanned_at as string),
    });
  }

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
      hasStoredPdf: row.file_format === "pdf" && Boolean(row.storage_path),
      fileFormat: row.file_format,
      sourceSystem: row.source_system,
      importMethod: row.import_method,
      parserMetadata: row.parser_metadata,
      warnings: (row.import_warnings as string[] | null) ?? [],
      archivedAt: (row.archived_at as string | null) ?? null,
      scanCount: usageByUpload.get(row.id as string)?.scanCount ?? 0,
      lastUsedAt: usageByUpload.get(row.id as string)?.lastUsedAt ?? null,
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
  const dealershipId = requireApiDealershipId();
  const { data, error } = await supabase
    .from("vehicle_scans")
    .select("id, vin_suffix, model, color, scanned_at, latitude, longitude, matched, scanner_email")
    .eq("dealership_id", dealershipId)
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

export async function uploadInventoryFile(file: File): Promise<InventoryImportSummary> {
  if (isDemoLotEnabled()) {
    const fileFormat = file.name.toLowerCase().endsWith(".csv") ? "csv" : "pdf";
    demoUploadedPdf = fileFormat === "pdf" ? file : null;
    const itemCount = demoUploadAuditFile(file.name, fileFormat);
    return {
      fileName: file.name,
      uploadedAt: new Date().toISOString(),
      itemCount,
      items: [],
      fileFormat,
      sourceSystem: "demo",
      importMethod: "manual",
      detectedColumns: [],
      warnings: [],
      parserMetadata: {},
    };
  }
  const formData = new FormData();
  formData.append("file", file, file.name);
  const dealershipId = requireApiDealershipId();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sign in again to upload a price list.");
  const response = await fetch(UPLOAD_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Auditur-Dealership-ID": dealershipId,
    },
    body: formData,
  });
  const data = (await response.json().catch(() => ({}))) as
    | InventoryImportSummary
    | { error: string };
  if (!response.ok) {
    throw new Error("error" in data ? data.error : "Upload failed.");
  }
  if ("error" in data) throw new Error(data.error);
  return data;
}

export async function deleteInventoryUpload(uploadId: string): Promise<void> {
  if (isDemoLotEnabled()) {
    demoDeleteUpload(uploadId);
    return;
  }
  const dealershipId = requireApiDealershipId();
  const { data: upload, error: fetchError } = await supabase
    .from("inventory_uploads")
    .select("storage_path")
    .eq("id", uploadId)
    .eq("dealership_id", dealershipId)
    .maybeSingle();
  if (fetchError) throw fetchError;

  const { error } = await supabase.rpc("delete_inventory_upload", {
    target_upload_id: uploadId,
  });
  if (error) throw error;

  if (upload?.storage_path) {
    await supabase.storage
      .from("price-lists")
      .remove([upload.storage_path as string]);
  }
}

export async function exportHighlightedAuditPdf(): Promise<void> {
  if (isDemoLotEnabled()) {
    if (!demoUploadedPdf) {
      throw new Error(
        "Upload a PDF in this browser session before exporting from demo mode.",
      );
    }
    const url = URL.createObjectURL(demoUploadedPdf);
    const a = document.createElement("a");
    a.href = url;
    a.download = demoUploadedPdf.name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  const dealershipId = requireApiDealershipId();
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Sign in again to export this audit.");
  const response = await fetch(EXPORT_API_URL, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Auditur-Dealership-ID": dealershipId,
    },
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Export failed.");
  }
  const bytes = await response.arrayBuffer();
  const signature = new TextDecoder("ascii").decode(bytes.slice(0, 5));
  if (signature !== "%PDF-") {
    throw new Error(
      "The export server did not return a valid PDF. Check the Auditur API deployment and try again.",
    );
  }
  const blob = new Blob([bytes], { type: "application/pdf" });
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
  const dealershipId = requireApiDealershipId();
  const { data: row, error: fetchError } = await supabase
    .from("vehicle_scans")
    .select("vin_suffix")
    .eq("id", id)
    .eq("dealership_id", dealershipId)
    .single();
  if (fetchError || !row) throw fetchError ?? new Error("Vehicle not found.");

  const { error } = await supabase
    .from("vehicle_scans")
    .update({ model: updates.model, color: updates.color })
    .eq("dealership_id", dealershipId)
    .eq("vin_suffix", row.vin_suffix);
  if (error) throw error;
}

export async function markVehicleRemoved(itemId: string): Promise<void> {
  if (isDemoLotEnabled()) return;
  const { error } = await supabase.rpc("remove_inventory_vehicle", {
    target_item_id: itemId,
  });
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
  const dealershipId = requireApiDealershipId();
  const name = input.name.trim();
  const newPolygon = serializeZonePolygons([input.coordinates])[0];
  if (!newPolygon) throw new Error("Draw at least 3 corners before saving.");

  const { data: existingRows, error: listError } = await supabase
    .from("lot_zones")
    .select("*")
    .eq("dealership_id", dealershipId)
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
      .eq("dealership_id", dealershipId)
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
      dealership_id: dealershipId,
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
  const dealershipId = requireApiDealershipId();
  const { error } = await supabase
    .from("lot_zones")
    .update({ fill_color: colors.fillColor, stroke_color: colors.strokeColor })
    .eq("id", id)
    .eq("dealership_id", dealershipId);
  if (error) throw error;
}

export async function deleteLotZone(id: string): Promise<void> {
  if (isDemoLotEnabled()) {
    demoDeleteZone(id);
    return;
  }
  const dealershipId = requireApiDealershipId();
  const { error } = await supabase
    .from("lot_zones")
    .delete()
    .eq("id", id)
    .eq("dealership_id", dealershipId);
  if (error) throw error;
}

export type { InventoryUploadLog };
