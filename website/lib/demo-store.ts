import { isAdminBypassActive } from "@/lib/admin-access";
import { buildTodayAuditSummary } from "@/lib/audit";
import { findZoneForPoint, isScannedToday } from "@/lib/geo";
import { ZONE_COLOR_OPTIONS } from "@/lib/web-api-constants";
import type {
  DashboardData,
  InventoryItem,
  InventoryUploadLog,
  LotZone,
  ScanFeedItem,
  ZoneStat,
} from "@/lib/types";
import type { ScannedVehicleRow } from "@/lib/web-api-types";

const DEMO_FLAG = "auditur.demoLot.enabled";
const DEMO_STATE = "auditur.demoLot.state.v2";

/** Rough dealership lot near DFW for satellite / rotate demos. */
const LOT = {
  lat: 32.899_002,
  lng: -97.040_337,
};

type DemoScan = ScannedVehicleRow;

type DemoUpload = InventoryUploadLog & {
  items: InventoryItem[];
};

type DemoState = {
  selectedUploadId: string;
  uploads: DemoUpload[];
  scans: DemoScan[];
  zones: LotZone[];
};

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function car(
  vinSuffix: string,
  model: string,
  color: string,
  daysOnLot: number,
): InventoryItem {
  return { vinSuffix, model, color, daysOnLot };
}

function buildSeed(): DemoState {
  const upload1Items = [
    car("A1842", "F-150 XLT", "Oxford White", 12),
    car("B3310", "Explorer ST", "Agate Black", 4),
    car("C9021", "Bronco Sport", "Area 51", 21),
    car("D4412", "Mustang GT", "Grabber Blue", 9),
    car("E7780", "Escape Hybrid", "Space White", 2),
    car("F1209", "Ranger Lariat", "Cyber Orange", 16),
    car("G5530", "Edge SEL", "Carbonized Gray", 7),
    car("H8901", "Maverick XL", "Area 51", 3),
    car("J2204", "Transit Cargo", "Oxford White", 28),
    car("K6677", "Expedition Max", "Star White", 11),
  ];

  const upload2Items = [
    ...upload1Items,
    car("L1102", "F-250 Lariat", "Antimatter Blue", 1),
    car("M3344", "Bronco Badlands", "Cactus Gray", 5),
    car("N7788", "Mach-E GT", "Grabber Yellow", 8),
  ];

  const uploads: DemoUpload[] = [
    {
      id: "upload-demo-2",
      fileName: "DFW-Used-PriceList-Jul.pdf",
      uploadedAt: hoursAgo(8),
      itemCount: upload2Items.length,
      isCurrent: true,
      hasStoredPdf: true,
      items: upload2Items,
    },
    {
      id: "upload-demo-1",
      fileName: "DFW-Used-PriceList-Jun.pdf",
      uploadedAt: hoursAgo(96),
      itemCount: upload1Items.length,
      isCurrent: false,
      hasStoredPdf: true,
      items: upload1Items,
    },
  ];

  const scans: DemoScan[] = [
    {
      id: "scan-1",
      vinSuffix: "A1842",
      model: "F-150 XLT",
      color: "Oxford White",
      scannedAt: hoursAgo(1.2),
      latitude: LOT.lat + 0.00021,
      longitude: LOT.lng - 0.00018,
      matched: true,
      scannerEmail: "yard@auditur.app",
    },
    {
      id: "scan-2",
      vinSuffix: "B3310",
      model: "Explorer ST",
      color: "Agate Black",
      scannedAt: hoursAgo(2.1),
      latitude: LOT.lat + 0.00005,
      longitude: LOT.lng + 0.00022,
      matched: true,
      scannerEmail: "yard@auditur.app",
    },
    {
      id: "scan-3",
      vinSuffix: "D4412",
      model: "Mustang GT",
      color: "Grabber Blue",
      scannedAt: hoursAgo(0.4),
      latitude: LOT.lat - 0.00015,
      longitude: LOT.lng + 0.00012,
      matched: true,
      scannerEmail: "lead@auditur.app",
    },
    {
      id: "scan-4",
      vinSuffix: "F1209",
      model: "Ranger Lariat",
      color: "Cyber Orange",
      scannedAt: hoursAgo(3.5),
      latitude: LOT.lat - 0.00028,
      longitude: LOT.lng - 0.00025,
      matched: true,
      scannerEmail: "yard@auditur.app",
    },
    {
      id: "scan-5",
      vinSuffix: "H8901",
      model: "Maverick XL",
      color: "Area 51",
      scannedAt: hoursAgo(0.8),
      latitude: LOT.lat + 0.00032,
      longitude: LOT.lng - 0.00005,
      matched: true,
      scannerEmail: "yard@auditur.app",
    },
    {
      id: "scan-6",
      vinSuffix: "Z9999",
      model: "Unknown Truck",
      color: "Silver",
      scannedAt: hoursAgo(0.2),
      latitude: LOT.lat + 0.0001,
      longitude: LOT.lng + 0.00035,
      matched: false,
      scannerEmail: "yard@auditur.app",
    },
  ];

  const front = ZONE_COLOR_OPTIONS[0];
  const online = ZONE_COLOR_OPTIONS[1];
  const service = ZONE_COLOR_OPTIONS[3];

  const zones: LotZone[] = [
    {
      id: "zone-front",
      name: "Front Row",
      fillColor: front.fill,
      strokeColor: front.stroke,
      polygons: [
        [
          { latitude: LOT.lat + 0.0004, longitude: LOT.lng - 0.00045 },
          { latitude: LOT.lat + 0.0004, longitude: LOT.lng + 0.00005 },
          { latitude: LOT.lat + 0.00005, longitude: LOT.lng + 0.00005 },
          { latitude: LOT.lat + 0.00005, longitude: LOT.lng - 0.00045 },
        ],
      ],
    },
    {
      id: "zone-online",
      name: "Online",
      fillColor: online.fill,
      strokeColor: online.stroke,
      polygons: [
        [
          { latitude: LOT.lat + 0.00005, longitude: LOT.lng + 0.00008 },
          { latitude: LOT.lat + 0.00005, longitude: LOT.lng + 0.00055 },
          { latitude: LOT.lat - 0.0003, longitude: LOT.lng + 0.00055 },
          { latitude: LOT.lat - 0.0003, longitude: LOT.lng + 0.00008 },
        ],
      ],
    },
    {
      id: "zone-service",
      name: "Service",
      fillColor: service.fill,
      strokeColor: service.stroke,
      polygons: [
        [
          { latitude: LOT.lat - 0.00005, longitude: LOT.lng - 0.00045 },
          { latitude: LOT.lat - 0.00005, longitude: LOT.lng - 0.00005 },
          { latitude: LOT.lat - 0.0004, longitude: LOT.lng - 0.00005 },
          { latitude: LOT.lat - 0.0004, longitude: LOT.lng - 0.00045 },
        ],
      ],
    },
  ];

  return {
    selectedUploadId: uploads[0].id,
    uploads,
    scans,
    zones,
  };
}

export function isDemoLotEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (isAdminBypassActive()) return true;
  return window.localStorage.getItem(DEMO_FLAG) === "1";
}

export function enableDemoLot(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_FLAG, "1");
  if (!window.localStorage.getItem(DEMO_STATE)) {
    window.localStorage.setItem(DEMO_STATE, JSON.stringify(buildSeed()));
  }
}

export function ensureDemoLotForAdmin(): void {
  if (typeof window === "undefined") return;
  if (!isAdminBypassActive()) return;
  enableDemoLot();
}

function readState(): DemoState {
  ensureDemoLotForAdmin();
  if (typeof window === "undefined") return buildSeed();
  try {
    const raw = window.localStorage.getItem(DEMO_STATE);
    if (!raw) {
      const seed = buildSeed();
      window.localStorage.setItem(DEMO_STATE, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as DemoState;
  } catch {
    const seed = buildSeed();
    window.localStorage.setItem(DEMO_STATE, JSON.stringify(seed));
    return seed;
  }
}

function writeState(state: DemoState) {
  window.localStorage.setItem(DEMO_STATE, JSON.stringify(state));
}

export function resetDemoLot(): DemoState {
  const seed = buildSeed();
  writeState(seed);
  window.localStorage.setItem(DEMO_FLAG, "1");
  return seed;
}

function selectedUpload(state: DemoState, uploadId?: string | null): DemoUpload {
  const id = uploadId || state.selectedUploadId || state.uploads[0]?.id;
  return state.uploads.find((u) => u.id === id) ?? state.uploads[0];
}

export function setDemoSelectedUpload(uploadId: string): void {
  const state = readState();
  if (!state.uploads.some((u) => u.id === uploadId)) {
    throw new Error("Upload not found.");
  }
  state.selectedUploadId = uploadId;
  state.uploads = state.uploads.map((u) => ({ ...u, isCurrent: u.id === uploadId }));
  writeState(state);
}

export function getDemoDashboard(uploadId?: string | null): DashboardData {
  const state = readState();
  const upload = selectedUpload(state, uploadId);
  const inventory = upload?.items ?? [];
  const fileName = upload?.fileName ?? null;

  const audit = buildTodayAuditSummary({
    inventoryFileName: fileName,
    inventoryItems: inventory,
    scansToday: state.scans.map((row) => ({
      vinSuffix: row.vinSuffix,
      model: row.model,
      color: row.color,
      scannedAt: row.scannedAt,
      scannerEmail: row.scannerEmail,
      matched: row.matched,
    })),
  });

  const recentScans: ScanFeedItem[] = [...state.scans]
    .sort((a, b) => b.scannedAt.localeCompare(a.scannedAt))
    .slice(0, 12)
    .map((row) => {
      const zoneId = findZoneForPoint(
        { latitude: row.latitude, longitude: row.longitude },
        state.zones,
      );
      const zone = state.zones.find((z) => z.id === zoneId);
      return {
        id: row.id,
        vinSuffix: row.vinSuffix,
        model: row.model,
        color: row.color,
        scannedAt: row.scannedAt,
        scannerEmail: row.scannerEmail,
        zoneName: zone?.name ?? null,
        matched: row.matched,
      };
    });

  const zoneVinSets = new Map<string, Set<string>>();
  for (const row of state.scans) {
    if (!isScannedToday(row.scannedAt)) continue;
    const zoneId = findZoneForPoint(
      { latitude: row.latitude, longitude: row.longitude },
      state.zones,
    );
    if (!zoneId) continue;
    const set = zoneVinSets.get(zoneId) ?? new Set<string>();
    set.add(row.vinSuffix.toUpperCase());
    zoneVinSets.set(zoneId, set);
  }

  const zoneStats: ZoneStat[] = state.zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    strokeColor: zone.strokeColor,
    count: zoneVinSets.get(zone.id)?.size ?? 0,
  }));

  return {
    audit,
    recentScans,
    uploadLog: state.uploads.map((u) => ({
      id: u.id,
      fileName: u.fileName,
      uploadedAt: u.uploadedAt,
      itemCount: u.itemCount,
      isCurrent: u.id === upload?.id,
      hasStoredPdf: u.hasStoredPdf,
    })),
    zoneStats,
    totalPinnedVehicles: new Set(state.scans.map((s) => s.vinSuffix.toUpperCase())).size,
  };
}

export function getDemoZones(): LotZone[] {
  return readState().zones;
}

export function getDemoScannedVehicles(): ScannedVehicleRow[] {
  const latest = new Map<string, ScannedVehicleRow>();
  for (const row of readState().scans) {
    const key = row.vinSuffix.toUpperCase();
    if (!latest.has(key)) latest.set(key, row);
  }
  return Array.from(latest.values());
}

export function getDemoInventory(uploadId?: string | null): {
  fileName: string;
  items: InventoryItem[];
} {
  const state = readState();
  const upload = selectedUpload(state, uploadId);
  return { fileName: upload.fileName, items: upload.items };
}

export function demoCreateZone(input: {
  name: string;
  coordinates: { latitude: number; longitude: number }[];
  colorIndex?: number;
  strokeColor?: string;
  fillColor?: string;
}): LotZone {
  const state = readState();
  const name = input.name.trim() || "Untitled zone";
  const preset = ZONE_COLOR_OPTIONS[(input.colorIndex ?? 0) % ZONE_COLOR_OPTIONS.length];
  const strokeColor = input.strokeColor ?? preset.stroke;
  const fillColor = input.fillColor ?? preset.fill;
  const normalized = name.toLowerCase();
  const existing = state.zones.find((z) => z.name.toLowerCase() === normalized);
  if (existing) {
    existing.polygons = [...existing.polygons, input.coordinates];
    writeState(state);
    return existing;
  }
  const zone: LotZone = {
    id: `zone-${Date.now()}`,
    name,
    polygons: [input.coordinates],
    fillColor,
    strokeColor,
  };
  state.zones.push(zone);
  writeState(state);
  return zone;
}

export function demoUpdateZoneColors(
  id: string,
  colors: { fillColor: string; strokeColor: string },
): void {
  const state = readState();
  const zone = state.zones.find((z) => z.id === id);
  if (!zone) throw new Error("Zone not found.");
  zone.fillColor = colors.fillColor;
  zone.strokeColor = colors.strokeColor;
  writeState(state);
}

export function demoDeleteZone(id: string): void {
  const state = readState();
  state.zones = state.zones.filter((z) => z.id !== id);
  writeState(state);
}

export function demoUpdateVehicle(id: string, updates: { model: string; color: string }): void {
  const state = readState();
  const row = state.scans.find((s) => s.id === id);
  if (!row) throw new Error("Vehicle not found.");
  for (const scan of state.scans) {
    if (scan.vinSuffix.toUpperCase() === row.vinSuffix.toUpperCase()) {
      scan.model = updates.model;
      scan.color = updates.color;
    }
  }
  writeState(state);
}

export function demoDeleteVehicle(vinSuffix: string): void {
  const state = readState();
  const key = vinSuffix.trim().toUpperCase();
  state.scans = state.scans.filter((s) => s.vinSuffix.toUpperCase() !== key);
  writeState(state);
}

export function demoDeleteUpload(uploadId: string): void {
  const state = readState();
  state.uploads = state.uploads.filter((u) => u.id !== uploadId);
  if (state.uploads[0]) {
    state.selectedUploadId = state.uploads[0].id;
    state.uploads = state.uploads.map((u, i) => ({ ...u, isCurrent: i === 0 }));
  } else {
    state.selectedUploadId = "";
  }
  writeState(state);
}

export function demoUploadPdf(fileName: string): void {
  const state = readState();
  const template = state.uploads[0]?.items ?? [];
  const id = `upload-${Date.now()}`;
  state.uploads = state.uploads.map((u) => ({ ...u, isCurrent: false }));
  state.uploads.unshift({
    id,
    fileName,
    uploadedAt: new Date().toISOString(),
    itemCount: template.length,
    isCurrent: true,
    hasStoredPdf: true,
    items: template,
  });
  state.selectedUploadId = id;
  writeState(state);
}

export function demoExportPdfBlob(): Blob {
  const text = "Auditur demo highlighted audit PDF — replace with a live export when connected.";
  return new Blob([text], { type: "application/pdf" });
}

export { LOT as DEMO_LOT_CENTER };
