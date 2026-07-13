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
const DEMO_STATE = "auditur.demoLot.state.v1";

/** Rough dealership lot near DFW for satellite / rotate demos. */
const LOT = {
  lat: 32.899_002,
  lng: -97.040_337,
};

type DemoScan = ScannedVehicleRow & { id: string };

type DemoState = {
  inventoryFileName: string;
  inventory: InventoryItem[];
  uploads: InventoryUploadLog[];
  scans: DemoScan[];
  zones: LotZone[];
};

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

function buildSeed(): DemoState {
  const inventory: InventoryItem[] = [
    { vinSuffix: "A1842", model: "F-150 XLT", color: "Oxford White", daysOnLot: 12 },
    { vinSuffix: "B3310", model: "Explorer ST", color: "Agate Black", daysOnLot: 4 },
    { vinSuffix: "C9021", model: "Bronco Sport", color: "Area 51", daysOnLot: 21 },
    { vinSuffix: "D4412", model: "Mustang GT", color: "Grabber Blue", daysOnLot: 9 },
    { vinSuffix: "E7780", model: "Escape Hybrid", color: "Space White", daysOnLot: 2 },
    { vinSuffix: "F1209", model: "Ranger Lariat", color: "Cyber Orange", daysOnLot: 16 },
    { vinSuffix: "G5530", model: "Edge SEL", color: "Carbonized Gray", daysOnLot: 7 },
    { vinSuffix: "H8901", model: "Maverick XL", color: "Area 51", daysOnLot: 3 },
    { vinSuffix: "J2204", model: "Transit Cargo", color: "Oxford White", daysOnLot: 28 },
    { vinSuffix: "K6677", model: "Expedition Max", color: "Star White", daysOnLot: 11 },
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
    inventoryFileName: "DFW-Used-PriceList-Demo.pdf",
    inventory,
    uploads: [
      {
        id: "upload-demo-1",
        fileName: "DFW-Used-PriceList-Demo.pdf",
        uploadedAt: hoursAgo(26),
        itemCount: inventory.length,
        isCurrent: true,
        hasStoredPdf: true,
      },
      {
        id: "upload-demo-0",
        fileName: "DFW-Used-PriceList-Jun.pdf",
        uploadedAt: hoursAgo(96),
        itemCount: 48,
        isCurrent: false,
        hasStoredPdf: false,
      },
    ],
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

export function getDemoDashboard(): DashboardData {
  const state = readState();
  const audit = buildTodayAuditSummary({
    inventoryFileName: state.inventoryFileName,
    inventoryItems: state.inventory,
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
    uploadLog: state.uploads,
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

export function getDemoInventory(): { fileName: string; items: InventoryItem[] } {
  const state = readState();
  return { fileName: state.inventoryFileName, items: state.inventory };
}

export function demoCreateZone(input: {
  name: string;
  coordinates: { latitude: number; longitude: number }[];
  colorIndex?: number;
}): LotZone {
  const state = readState();
  const name = input.name.trim() || "Untitled zone";
  const colors = ZONE_COLOR_OPTIONS[(input.colorIndex ?? 0) % ZONE_COLOR_OPTIONS.length];
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
    fillColor: colors.fill,
    strokeColor: colors.stroke,
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
    state.uploads = state.uploads.map((u, i) => ({ ...u, isCurrent: i === 0 }));
    state.inventoryFileName = state.uploads[0].fileName;
  } else {
    state.inventory = [];
    state.inventoryFileName = "No price list";
  }
  writeState(state);
}

export function demoUploadPdf(fileName: string): void {
  const state = readState();
  state.uploads = state.uploads.map((u) => ({ ...u, isCurrent: false }));
  state.uploads.unshift({
    id: `upload-${Date.now()}`,
    fileName,
    uploadedAt: new Date().toISOString(),
    itemCount: state.inventory.length,
    isCurrent: true,
    hasStoredPdf: true,
  });
  state.inventoryFileName = fileName;
  writeState(state);
}

export function demoExportPdfBlob(): Blob {
  const text = "Auditur demo highlighted audit PDF — replace with a live export when connected.";
  return new Blob([text], { type: "application/pdf" });
}

export { LOT as DEMO_LOT_CENTER };
