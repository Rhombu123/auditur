import { buildTodayAuditSummary } from "@/lib/audit";
import { requireApiDealershipId } from "@/lib/active-dealership";
import { readApiJson } from "@/lib/fetch-json";
import { getErrorMessage } from "@/lib/errors";
import {
  clearMobileCache,
  MOBILE_CACHE_KEYS,
} from "@/lib/mobile-cache";
import { supabase } from "@/lib/supabase";
import {
  normalizeZoneName,
  parseZonePolygons,
  serializeZonePolygons,
} from "@/lib/lot-zone-storage";
import type {
  InventoryItem,
  InventoryImportSummary,
  InventorySnapshot,
  InventoryUploadLog,
  LotStatus,
  LotVehicle,
  LotZone,
  ScanRecord,
  ScannedVehicle,
  TodayAuditSummary,
  VehicleSearchResult,
} from "@/lib/types";
import { decodeVinFromNhtsa, formatDecodedVehicle } from "@/lib/vin-decode";
import { matchesVehicleSearch } from "@/lib/vin-search";
import { zoneColorByIndex } from "@/lib/zone-colors";

const configuredUploadApiUrl =
  process.env.EXPO_PUBLIC_UPLOAD_API_URL ??
  "https://auditur.vercel.app/api/upload/";
const uploadApiUrl = configuredUploadApiUrl.endsWith("/")
  ? configuredUploadApiUrl
  : `${configuredUploadApiUrl}/`;

const ocrApiUrl =
  process.env.EXPO_PUBLIC_OCR_API_URL ??
  uploadApiUrl.replace(/\/upload\/$/, "/ocr/");

async function authenticatedApiHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in again to continue.");
  return {
    Authorization: `Bearer ${token}`,
    "X-Auditur-Dealership-ID": requireApiDealershipId(),
  };
}

function isScannedToday(scannedAt: string): boolean {
  const scanned = new Date(scannedAt);
  const now = new Date();
  return (
    scanned.getFullYear() === now.getFullYear() &&
    scanned.getMonth() === now.getMonth() &&
    scanned.getDate() === now.getDate()
  );
}

export async function uploadInventoryFile(
  fileUri: string,
  fileName: string,
  mimeType?: string | null,
): Promise<InventoryImportSummary> {
  const fileFormat = fileName.toLowerCase().endsWith(".csv") ? "csv" : "pdf";
  const formData = new FormData();
  formData.append("file", {
    uri: fileUri,
    name: fileName,
    type:
      mimeType ??
      (fileFormat === "csv" ? "text/csv" : "application/pdf"),
  } as unknown as Blob);

  let response: Response;
  try {
    response = await fetch(uploadApiUrl, {
      method: "POST",
      headers: await authenticatedApiHeaders(),
      body: formData,
    });
  } catch (error) {
    const message = getErrorMessage(error, "");
    throw new Error(
      /load failed|network request failed|failed to fetch/i.test(message)
        ? "Could not reach the upload server. Check your connection and try again."
        : message || "The upload could not be started.",
    );
  }

  const data = await readApiJson<
    | {
        fileName: string;
        uploadedAt?: string;
        uploadId?: string;
        itemCount?: number;
        items: InventoryItem[];
        fileFormat: "pdf" | "csv";
        sourceSystem: string;
        importMethod: "manual";
        detectedColumns?: string[];
        warnings?: string[];
        parserMetadata?: Record<string, unknown>;
      }
    | { error: string }
  >(response);

  if (!response.ok) {
    throw new Error("error" in data ? data.error : "Upload failed.");
  }

  if ("error" in data) {
    throw new Error(data.error);
  }

  return {
    uploadId: data.uploadId,
    fileName: data.fileName,
    uploadedAt: data.uploadedAt ?? new Date().toISOString(),
    itemCount: data.itemCount ?? data.items.length,
    items: data.items,
    fileFormat: data.fileFormat,
    sourceSystem: data.sourceSystem,
    importMethod: data.importMethod,
    detectedColumns: data.detectedColumns ?? [],
    warnings: data.warnings ?? [],
    parserMetadata: data.parserMetadata ?? {},
  };
}

export async function ocrVinFromImage(
  imageUri: string,
): Promise<{ rawText: string | null; vin: string | null; vinSuffix: string | null }> {
  const formData = new FormData();
  formData.append("file", {
    uri: imageUri,
    name: "vin.jpg",
    type: "image/jpeg",
  } as unknown as Blob);

  const response = await fetch(ocrApiUrl, {
    method: "POST",
    headers: await authenticatedApiHeaders(),
    body: formData,
  });

  const data = await readApiJson<
    | { rawText?: string; vin?: string | null; vinSuffix?: string | null }
    | { error: string }
  >(response);

  if (!response.ok) {
    throw new Error("error" in data ? data.error : "OCR failed.");
  }

  if ("error" in data) {
    throw new Error(data.error);
  }

  return {
    rawText: data.rawText ?? null,
    vin: "vin" in data ? (data.vin ?? null) : null,
    vinSuffix: data.vinSuffix ?? ("vin" in data ? data.vin : null) ?? null,
  };
}

export async function fetchInventory(): Promise<InventorySnapshot | null> {
  const dealershipId = requireApiDealershipId();
  const { data: upload, error: uploadError } = await supabase
    .from("inventory_uploads")
    .select(
      "id, file_name, uploaded_at, file_format, source_system, import_method, parser_metadata, import_warnings",
    )
    .eq("dealership_id", dealershipId)
    .is("archived_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (uploadError) throw uploadError;
  if (!upload) return null;

  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select(
      "id, vin, vin_suffix, stock_number, make, model, color, source_status, days_on_lot, miles, year, lot_status",
    )
    .eq("dealership_id", dealershipId)
    .eq("upload_id", upload.id)
    .eq("lot_status", "active")
    .order("vin_suffix", { ascending: true });

  if (itemsError) throw itemsError;

  return {
    id: upload.id,
    fileName: upload.file_name,
    uploadedAt: upload.uploaded_at,
    fileFormat: upload.file_format,
    sourceSystem: upload.source_system,
    importMethod: upload.import_method,
    parserMetadata: upload.parser_metadata,
    warnings: upload.import_warnings,
    items: (items ?? []).map((row) => ({
      id: row.id,
      vin: row.vin,
      vinSuffix: row.vin_suffix,
      stockNumber: row.stock_number,
      make: row.make,
      model: row.model,
      color: row.color,
      sourceStatus: row.source_status,
      daysOnLot: row.days_on_lot,
      miles: row.miles,
      year: row.year,
      lotStatus: row.lot_status,
    })),
  };
}

export async function fetchUploadHistory(): Promise<InventoryUploadLog[]> {
  const dealershipId = requireApiDealershipId();
  const [uploadResult, scanResult] = await Promise.all([
    supabase
      .from("inventory_uploads")
      .select(
        "id, file_name, uploaded_at, item_count, storage_path, archived_at, file_format, source_system, import_method, parser_metadata, import_warnings",
      )
      .eq("dealership_id", dealershipId)
      .order("uploaded_at", { ascending: false })
      .limit(25),
    supabase
      .from("vehicle_scans")
      .select("inventory_upload_id, scanned_at")
      .eq("dealership_id", dealershipId)
      .not("inventory_upload_id", "is", null)
      .order("scanned_at", { ascending: false })
      .limit(10000),
  ]);

  if (uploadResult.error) throw uploadResult.error;
  if (scanResult.error) throw scanResult.error;

  const usageByUpload = new Map<
    string,
    { scanCount: number; lastUsedAt: string }
  >();
  for (const scan of scanResult.data ?? []) {
    if (!scan.inventory_upload_id) continue;
    const current = usageByUpload.get(scan.inventory_upload_id);
    usageByUpload.set(scan.inventory_upload_id, {
      scanCount: (current?.scanCount ?? 0) + 1,
      lastUsedAt: current?.lastUsedAt ?? scan.scanned_at,
    });
  }

  return (uploadResult.data ?? []).map((row) => ({
    id: row.id,
    fileName: row.file_name,
    uploadedAt: row.uploaded_at,
    itemCount: row.item_count ?? 0,
    isCurrent: row.archived_at == null,
    hasStoredPdf: row.file_format === "pdf" && Boolean(row.storage_path),
    fileFormat: row.file_format,
    sourceSystem: row.source_system,
    importMethod: row.import_method,
    parserMetadata: row.parser_metadata,
    warnings: row.import_warnings ?? [],
    archivedAt: row.archived_at,
    scanCount: usageByUpload.get(row.id)?.scanCount ?? 0,
    lastUsedAt: usageByUpload.get(row.id)?.lastUsedAt ?? null,
  }));
}

export async function archiveInventoryUpload(uploadId: string): Promise<void> {
  const { error } = await supabase.rpc("archive_inventory_upload", {
    target_upload_id: uploadId,
  });
  if (error) {
    throw new Error(getErrorMessage(error, "Could not remove the current audit file."));
  }
  await Promise.all([
    clearMobileCache(MOBILE_CACHE_KEYS.audit),
    clearMobileCache(MOBILE_CACHE_KEYS.inventory),
    clearMobileCache(MOBILE_CACHE_KEYS.uploadHistory),
  ]);
}

export async function deleteInventoryUpload(uploadId: string): Promise<void> {
  const dealershipId = requireApiDealershipId();
  const { data: upload, error: fetchError } = await supabase
    .from("inventory_uploads")
    .select("storage_path")
    .eq("id", uploadId)
    .eq("dealership_id", dealershipId)
    .maybeSingle();

  if (fetchError) {
    throw new Error(getErrorMessage(fetchError, "Could not find upload."));
  }

  const { error } = await supabase.rpc("delete_inventory_upload", {
    target_upload_id: uploadId,
  });
  if (error) {
    throw new Error(getErrorMessage(error, "Could not delete upload."));
  }

  if (upload?.storage_path) {
    await supabase.storage.from("price-lists").remove([upload.storage_path]);
  }
}

export async function matchInventoryItem(vinSuffix: string) {
  const inventory = await fetchInventory();
  if (!inventory) return { inventory: null, matchedItem: null };

  const normalized = vinSuffix.toUpperCase();
  const matchedItem =
    inventory.items.find((item) => item.vinSuffix.toUpperCase() === normalized) ??
    null;

  return { inventory, matchedItem };
}

export type ResolvedVehicle = {
  vehicle: InventoryItem;
  inventoryMatched: boolean;
  source: "inventory" | "nhtsa" | "manual";
};

export async function resolveVehicleDetails(
  vin: string | null,
  vinSuffix: string,
  existing?: {
    model: string | null;
    color: string | null;
    vin: string | null;
    days_on_lot?: number | null;
  } | null,
): Promise<ResolvedVehicle> {
  const { matchedItem } = await matchInventoryItem(vinSuffix);
  if (matchedItem) {
    return {
      vehicle: matchedItem,
      inventoryMatched: true,
      source: "inventory",
    };
  }

  const mergedVin = vin ?? existing?.vin ?? null;

  if (existing?.model && !existing.model.startsWith("Vehicle ")) {
    return {
      vehicle: {
        vinSuffix: vinSuffix.toUpperCase(),
        model: existing.model,
        color: existing.color ?? "Unknown",
        daysOnLot: existing.days_on_lot ?? null,
        year: yearFromModel(existing.model),
      },
      inventoryMatched: false,
      source: "manual",
    };
  }

  if (mergedVin) {
    const decoded = await decodeVinFromNhtsa(mergedVin);
    if (decoded) {
      return {
        vehicle: {
          vinSuffix: vinSuffix.toUpperCase(),
          model: formatDecodedVehicle(decoded),
          color: existing?.color ?? "Unknown",
          year: decoded.year,
          daysOnLot: existing?.days_on_lot ?? null,
        },
        inventoryMatched: false,
        source: "nhtsa",
      };
    }
  }

  return {
    vehicle: {
      vinSuffix: vinSuffix.toUpperCase(),
      model: existing?.model ?? `Vehicle ${vinSuffix.toUpperCase()}`,
      color: existing?.color ?? "Unknown",
      daysOnLot: existing?.days_on_lot ?? null,
      year: null,
    },
    inventoryMatched: false,
    source: "manual",
  };
}

function yearFromModel(model: string | null): number | null {
  const match = model?.match(/^((?:19|20)\d{2})\s/);
  return match ? Number(match[1]) : null;
}

export async function fetchLatestScanRow(vinSuffix: string) {
  const dealershipId = requireApiDealershipId();
  const { data } = await supabase
    .from("vehicle_scans")
    .select("*")
    .eq("dealership_id", dealershipId)
    .eq("vin_suffix", vinSuffix.toUpperCase())
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function saveScan(record: {
  vin: string | null;
  vinSuffix: string;
  rawValue: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  vehicle: InventoryItem;
  inventoryMatched: boolean;
}): Promise<ScanRecord & { isRescan: boolean }> {
  const dealershipId = requireApiDealershipId();
  const normalizedSuffix = record.vinSuffix.toUpperCase();
  const existing = await fetchLatestScanRow(normalizedSuffix);
  const mergedVin = record.vin ?? existing?.vin ?? null;
  const isRescan = Boolean(existing);

  const vehicle = { ...record.vehicle };
  if (!record.inventoryMatched && existing) {
    if (vehicle.model.startsWith("Vehicle ") && existing.model) {
      vehicle.model = existing.model;
    }
    if (vehicle.color === "Unknown" && existing.color) {
      vehicle.color = existing.color;
    }
    if (vehicle.daysOnLot == null && existing.days_on_lot != null) {
      vehicle.daysOnLot = existing.days_on_lot;
    }
  }

  const [{ data: authData }, inventoryUploadId] = await Promise.all([
    supabase.auth.getUser(),
    fetchLatestUploadId(),
  ]);
  const scanner = authData.user;

  const { data, error } = await supabase
    .from("vehicle_scans")
    .insert({
      vin: mergedVin,
      vin_suffix: normalizedSuffix,
      raw_value: record.rawValue,
      latitude: record.latitude,
      longitude: record.longitude,
      accuracy: record.accuracy,
      model: vehicle.model,
      color: vehicle.color,
      days_on_lot: vehicle.daysOnLot ?? null,
      matched: record.inventoryMatched,
      scanned_by: scanner?.id ?? null,
      scanner_email: scanner?.email ?? null,
      dealership_id: dealershipId,
      inventory_upload_id: inventoryUploadId,
    })
    .select("*")
    .single();

  if (error || !data) throw error ?? new Error("Failed to save scan.");

  const year = vehicle.year ?? yearFromModel(vehicle.model);

  return {
    id: data.id,
    vin: data.vin,
    vinSuffix: data.vin_suffix,
    rawValue: data.raw_value,
    latitude: data.latitude,
    longitude: data.longitude,
    accuracy: data.accuracy,
    matchedItem: {
      vinSuffix: data.vin_suffix,
      model: vehicle.model,
      color: vehicle.color,
      daysOnLot: vehicle.daysOnLot ?? data.days_on_lot,
      year,
    },
    scannedAt: data.scanned_at,
    isRescan,
  };
}

export async function voidVehicleScan(scanId: string): Promise<void> {
  const { error } = await supabase.rpc("void_vehicle_scan", {
    target_scan_id: scanId,
    reason: "Mistaken scan",
  });
  if (error) {
    throw new Error(getErrorMessage(error, "Could not remove the mistaken scan."));
  }
  await Promise.all([
    clearMobileCache(MOBILE_CACHE_KEYS.audit),
    clearMobileCache(MOBILE_CACHE_KEYS.vehicles),
  ]);
}

export async function deleteScannedVehicle(scanId: string): Promise<void> {
  const { error } = await supabase.rpc("void_scanned_vehicle", {
    target_scan_id: scanId,
    reason: "Vehicle deleted from the vehicle list",
  });
  if (error) {
    throw new Error(getErrorMessage(error, "Could not delete the vehicle."));
  }
  await Promise.all([
    clearMobileCache(MOBILE_CACHE_KEYS.audit),
    clearMobileCache(MOBILE_CACHE_KEYS.vehicles),
  ]);
}

function buildScanMatchedItem(
  row: {
    vin_suffix: string;
    model: string | null;
    color: string | null;
    days_on_lot: number | null;
    matched: boolean;
  },
  inventoryItem: InventoryItem | null,
): InventoryItem {
  if (row.matched && inventoryItem) {
    return {
      vinSuffix: row.vin_suffix,
      model: inventoryItem.model ?? row.model ?? "Unknown",
      color: inventoryItem.color ?? row.color ?? "Unknown",
      daysOnLot: inventoryItem.daysOnLot ?? row.days_on_lot,
      year: inventoryItem.year ?? yearFromModel(row.model),
      miles: inventoryItem.miles ?? null,
    };
  }

  const model =
    row.model ?? inventoryItem?.model ?? `Vehicle ${row.vin_suffix}`;
  const color = row.color ?? inventoryItem?.color ?? "Unknown";

  return {
    vinSuffix: row.vin_suffix,
    model,
    color,
    daysOnLot: row.days_on_lot ?? inventoryItem?.daysOnLot ?? null,
    year: inventoryItem?.year ?? yearFromModel(model),
    miles: inventoryItem?.miles ?? null,
  };
}

function mapScanRowToVehicle(
  row: {
    id: string;
    vin: string | null;
    vin_suffix: string;
    model: string | null;
    color: string | null;
    latitude: number;
    longitude: number;
    scanned_at: string;
    matched: boolean;
    lot_status?: string | null;
  },
  inventoryItem: InventoryItem | null,
  scanCount: number,
): ScannedVehicle {
  const lotStatus = normalizeLotStatus(
    row.lot_status ?? inventoryItem?.lotStatus ?? "active",
  );

  return {
    id: row.id,
    vinSuffix: row.vin_suffix,
    vin: row.vin,
    model:
      row.model ??
      inventoryItem?.model ??
      `Vehicle ${row.vin_suffix}`,
    color: row.color ?? inventoryItem?.color ?? "Unknown",
    year: inventoryItem?.year ?? yearFromModel(row.model ?? inventoryItem?.model ?? null),
    latitude: row.latitude,
    longitude: row.longitude,
    scannedAt: row.scanned_at,
    matched: row.matched,
    scanCount,
    lotStatus,
    inventoryItemId: inventoryItem?.id ?? null,
  };
}

function normalizeLotStatus(value: string | null | undefined): LotStatus {
  if (
    value === "sold" ||
    value === "auctioned" ||
    value === "removed" ||
    value === "active"
  ) {
    return value;
  }
  return "active";
}

async function fetchLatestUploadId(): Promise<string | null> {
  const dealershipId = requireApiDealershipId();
  const { data: upload, error } = await supabase
    .from("inventory_uploads")
    .select("id")
    .eq("dealership_id", dealershipId)
    .is("archived_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return upload?.id ?? null;
}

async function fetchInventoryStatusContext(): Promise<{
  uploadId: string | null;
  itemsByVin: Map<string, InventoryItem>;
}> {
  const dealershipId = requireApiDealershipId();
  const uploadId = await fetchLatestUploadId();
  if (!uploadId) return { uploadId: null, itemsByVin: new Map() };

  const { data: items, error } = await supabase
    .from("inventory_items")
    .select("id, vin_suffix, model, color, days_on_lot, miles, year, lot_status")
    .eq("dealership_id", dealershipId)
    .eq("upload_id", uploadId);

  if (error) throw error;

  return {
    uploadId,
    itemsByVin: new Map(
      (items ?? []).map((row) => [
        row.vin_suffix.toUpperCase(),
        {
          id: row.id,
          vinSuffix: row.vin_suffix,
          model: row.model,
          color: row.color,
          daysOnLot: row.days_on_lot,
          miles: row.miles,
          year: row.year,
          lotStatus: normalizeLotStatus(row.lot_status),
        },
      ]),
    ),
  };
}

export async function fetchScannedVehicles(): Promise<ScannedVehicle[]> {
  const dealershipId = requireApiDealershipId();
  const [{ data, error }, inventoryContext] = await Promise.all([
    supabase
      .from("vehicle_scans")
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("scanned_at", { ascending: false }),
    fetchInventoryStatusContext(),
  ]);

  if (error) throw error;

  const scanCountByVin = new Map<string, number>();
  const latestByVin = new Map<string, (typeof data)[number]>();

  for (const row of data ?? []) {
    const key = row.vin_suffix.toUpperCase();
    const belongsToCurrentInventory = inventoryContext.itemsByVin.has(key);
    const belongsToCurrentUpload =
      !inventoryContext.uploadId ||
      row.inventory_upload_id === inventoryContext.uploadId;
    if (!belongsToCurrentInventory && !belongsToCurrentUpload) continue;

    scanCountByVin.set(key, (scanCountByVin.get(key) ?? 0) + 1);
    if (!latestByVin.has(key)) {
      latestByVin.set(key, row);
    }
  }

  return Array.from(latestByVin.values()).map((row) =>
    mapScanRowToVehicle(
      row,
      inventoryContext.itemsByVin.get(row.vin_suffix.toUpperCase()) ?? null,
      scanCountByVin.get(row.vin_suffix.toUpperCase()) ?? 1,
    ),
  );
}

export async function updateScannedVehicle(
  id: string,
  updates: { model: string; color: string },
): Promise<void> {
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
    .update({
      model: updates.model,
      color: updates.color,
    })
    .eq("dealership_id", dealershipId)
    .eq("vin_suffix", row.vin_suffix);

  if (error) throw error;
}

export async function fetchVehicleScanHistory(vinSuffix: string): Promise<ScanRecord[]> {
  const dealershipId = requireApiDealershipId();
  const [{ data, error }, inventory] = await Promise.all([
    supabase
      .from("vehicle_scans")
      .select("*")
      .eq("dealership_id", dealershipId)
      .eq("vin_suffix", vinSuffix.toUpperCase())
      .order("scanned_at", { ascending: false }),
    fetchInventory(),
  ]);

  if (error) throw error;

  const inventoryItem =
    (inventory?.items ?? []).find(
      (item) => item.vinSuffix.toUpperCase() === vinSuffix.toUpperCase(),
    ) ?? null;

  return (data ?? []).map((row) => ({
    id: row.id,
    vin: row.vin,
    vinSuffix: row.vin_suffix,
    rawValue: row.raw_value,
    latitude: row.latitude,
    longitude: row.longitude,
    accuracy: row.accuracy,
    matchedItem: buildScanMatchedItem(row, inventoryItem),
    scannedAt: row.scanned_at,
    scannerEmail: row.scanner_email ?? null,
  }));
}

export async function fetchTodayAudit(): Promise<TodayAuditSummary | null> {
  const dealershipId = requireApiDealershipId();
  const inventory = await fetchInventory();
  if (!inventory?.id) return null;
  const { data: scans, error } = await supabase
    .from("vehicle_scans")
    .select("vin_suffix, model, color, scanned_at, scanner_email, matched")
    .eq("dealership_id", dealershipId)
    .eq("inventory_upload_id", inventory.id)
    .order("scanned_at", { ascending: false });

  if (error) throw error;

  return {
    ...buildTodayAuditSummary({
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
    }),
    fileFormat: inventory.fileFormat,
    sourceSystem: inventory.sourceSystem,
    warnings: inventory.warnings,
  };
}

function mapLotZoneRow(row: {
  id: string;
  name: string;
  coordinates: unknown;
  fill_color: string;
  stroke_color: string;
  created_at: string;
}): LotZone {
  return {
    id: row.id,
    name: row.name,
    polygons: parseZonePolygons(row.coordinates),
    fillColor: row.fill_color,
    strokeColor: row.stroke_color,
    createdAt: row.created_at,
  };
}

export async function updateLotZone(
  id: string,
  polygons: { latitude: number; longitude: number }[][],
): Promise<LotZone> {
  return updateLotZonePolygons(id, polygons);
}

export async function updateLotZoneColors(
  id: string,
  colors: { fillColor: string; strokeColor: string },
): Promise<LotZone> {
  const dealershipId = requireApiDealershipId();
  const { data, error } = await supabase
    .from("lot_zones")
    .update({
      fill_color: colors.fillColor,
      stroke_color: colors.strokeColor,
    })
    .eq("id", id)
    .eq("dealership_id", dealershipId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(getErrorMessage(error, "Could not update zone color."));
  }

  return mapLotZoneRow(data);
}

async function updateLotZonePolygons(
  id: string,
  polygons: { latitude: number; longitude: number }[][],
): Promise<LotZone> {
  const dealershipId = requireApiDealershipId();
  const serialized = serializeZonePolygons(polygons);
  const { data, error } = await supabase
    .from("lot_zones")
    .update({ coordinates: serialized })
    .eq("id", id)
    .eq("dealership_id", dealershipId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(getErrorMessage(error, "Could not update lot zone."));
  }

  return mapLotZoneRow(data);
}

async function consolidateDuplicateZoneNames(zones: LotZone[]): Promise<LotZone[]> {
  const groups = new Map<string, LotZone[]>();

  for (const zone of zones) {
    const key = normalizeZoneName(zone.name);
    const group = groups.get(key) ?? [];
    group.push(zone);
    groups.set(key, group);
  }

  const consolidated: LotZone[] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      consolidated.push(group[0]);
      continue;
    }

    const primary = group[0];
    const mergedPolygons = serializeZonePolygons(
      group.flatMap((zone) => zone.polygons),
    );

    const merged = await updateLotZonePolygons(primary.id, mergedPolygons);
    for (const duplicate of group.slice(1)) {
      await deleteLotZone(duplicate.id);
    }
    consolidated.push(merged);
  }

  return consolidated.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export async function fetchLotZones(): Promise<LotZone[]> {
  const dealershipId = requireApiDealershipId();
  const { data, error } = await supabase
    .from("lot_zones")
    .select("*")
    .eq("dealership_id", dealershipId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  const zones = (data ?? []).map(mapLotZoneRow);
  return consolidateDuplicateZoneNames(zones);
}

export async function createLotZone(input: {
  name: string;
  coordinates: { latitude: number; longitude: number }[];
  colorIndex?: number;
  fillColor?: string;
  strokeColor?: string;
}): Promise<LotZone> {
  const dealershipId = requireApiDealershipId();
  const name = input.name.trim();
  const newPolygon = serializeZonePolygons([input.coordinates])[0];
  if (!newPolygon) {
    throw new Error("Draw at least 3 corners before saving.");
  }

  const { data: existingRows, error: listError } = await supabase
    .from("lot_zones")
    .select("*")
    .eq("dealership_id", dealershipId)
    .order("created_at", { ascending: true });

  if (listError) {
    throw new Error(getErrorMessage(listError, "Could not load lot zones."));
  }

  const normalized = normalizeZoneName(name);
  const existing = (existingRows ?? []).find(
    (row) => normalizeZoneName(row.name) === normalized,
  );

  if (existing) {
    const existingZone = mapLotZoneRow(existing);
    const mergedPolygons = serializeZonePolygons([
      ...existingZone.polygons,
      newPolygon,
    ]);
    return updateLotZonePolygons(existing.id, mergedPolygons);
  }

  const { data: authData } = await supabase.auth.getUser();
  const colors = zoneColorByIndex(input.colorIndex ?? 0);

  const { data, error } = await supabase
    .from("lot_zones")
    .insert({
      name,
      coordinates: [newPolygon],
      fill_color: input.fillColor ?? colors.fill,
      stroke_color: input.strokeColor ?? colors.stroke,
      created_by: authData.user?.id ?? null,
      dealership_id: dealershipId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(getErrorMessage(error, "Could not save lot zone."));
  }

  return mapLotZoneRow(data);
}

export async function deleteLotZone(id: string): Promise<void> {
  const dealershipId = requireApiDealershipId();
  const { error } = await supabase
    .from("lot_zones")
    .delete()
    .eq("id", id)
    .eq("dealership_id", dealershipId);
  if (error) {
    throw new Error(getErrorMessage(error, "Could not delete lot zone."));
  }
}

export async function fetchScans(): Promise<ScanRecord[]> {
  const dealershipId = requireApiDealershipId();
  const [{ data, error }, inventory] = await Promise.all([
    supabase
      .from("vehicle_scans")
      .select("*")
      .eq("dealership_id", dealershipId)
      .order("scanned_at", { ascending: false })
      .limit(100),
    fetchInventory(),
  ]);

  if (error) throw error;

  const inventoryByVin = new Map(
    (inventory?.items ?? []).map((item) => [item.vinSuffix.toUpperCase(), item]),
  );

  return (data ?? []).map((row) => {
    const inventoryItem =
      inventoryByVin.get(row.vin_suffix.toUpperCase()) ?? null;

    return {
      id: row.id,
      vin: row.vin,
      vinSuffix: row.vin_suffix,
      rawValue: row.raw_value,
      latitude: row.latitude,
      longitude: row.longitude,
      accuracy: row.accuracy,
      matchedItem: buildScanMatchedItem(row, inventoryItem),
      scannedAt: row.scanned_at,
      scannerEmail: row.scanner_email ?? null,
    };
  });
}

export async function fetchLotVehicles(): Promise<LotVehicle[]> {
  const dealershipId = requireApiDealershipId();
  const { data: upload, error: uploadError } = await supabase
    .from("inventory_uploads")
    .select("id")
    .eq("dealership_id", dealershipId)
    .is("archived_at", null)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (uploadError) throw uploadError;
  if (!upload) return [];

  const { data: items, error: itemsError } = await supabase
    .from("inventory_items")
    .select("id, vin_suffix, model, color, days_on_lot, miles, year, lot_status")
    .eq("dealership_id", dealershipId)
    .eq("upload_id", upload.id)
    .eq("lot_status", "active")
    .order("vin_suffix", { ascending: true });

  if (itemsError) throw itemsError;

  const { data: scans, error: scansError } = await supabase
    .from("vehicle_scans")
    .select("vin_suffix, latitude, longitude, scanned_at")
    .eq("dealership_id", dealershipId)
    .order("scanned_at", { ascending: false });

  if (scansError) throw scansError;

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

export async function markVehicleRemoved(
  itemId: string,
): Promise<void> {
  const { error } = await supabase.rpc("remove_inventory_vehicle", {
    target_item_id: itemId,
  });
  if (error) throw error;
}

export async function restoreVehicle(
  itemId: string,
): Promise<void> {
  const { error } = await supabase.rpc("restore_inventory_vehicle", {
    target_item_id: itemId,
  });
  if (error) throw error;
}

export async function searchAllVehicles(query: string): Promise<VehicleSearchResult[]> {
  const [scanned, inventory] = await Promise.all([
    fetchScannedVehicles(),
    fetchInventory(),
  ]);

  const results: VehicleSearchResult[] = [];

  for (const vehicle of scanned) {
    if (
      matchesVehicleSearch(query, {
        vin: vehicle.vin,
        vinSuffix: vehicle.vinSuffix,
        model: vehicle.model,
        color: vehicle.color,
      })
    ) {
      results.push({
        kind: "scanned",
        id: vehicle.id,
        vin: vehicle.vin,
        vinSuffix: vehicle.vinSuffix,
        model: vehicle.model,
        color: vehicle.color,
        scannedAt: vehicle.scannedAt,
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
      });
    }
  }

  for (const item of inventory?.items ?? []) {
    if (
      matchesVehicleSearch(query, {
        vin: null,
        vinSuffix: item.vinSuffix,
        model: item.model,
        color: item.color,
      })
    ) {
      const alreadyListed = results.some(
        (r) => r.kind === "scanned" && r.vinSuffix === item.vinSuffix,
      );
      if (!alreadyListed) {
        results.push({
          kind: "inventory",
          id: item.id ?? null,
          vin: null,
          vinSuffix: item.vinSuffix,
          model: item.model,
          color: item.color,
        });
      }
    }
  }

  return results.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "scanned" ? -1 : 1;
    return a.vinSuffix.localeCompare(b.vinSuffix);
  });
}
