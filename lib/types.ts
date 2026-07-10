export type InventoryItem = {
  id?: string;
  vinSuffix: string;
  model: string;
  color: string;
  daysOnLot: number | null;
  miles?: number | null;
  year?: number | null;
  lotStatus?: LotStatus;
};

export type LotStatus = "active" | "sold" | "auctioned";

export type InventorySnapshot = {
  fileName: string;
  uploadedAt: string;
  items: InventoryItem[];
};

export type ScanRecord = {
  id: string;
  vin: string | null;
  vinSuffix: string;
  scannedAt: string;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  matchedItem: InventoryItem | null;
  rawValue: string;
  scannerEmail?: string | null;
};

export type LotZone = {
  id: string;
  name: string;
  polygons: { latitude: number; longitude: number }[][];
  fillColor: string;
  strokeColor: string;
  createdAt: string;
};

export type AuditVehicleRef = {
  vinSuffix: string;
  model: string;
  color: string;
  scannedAt?: string;
  scannerEmail?: string | null;
};

export type TodayAuditSummary = {
  expectedCount: number;
  scannedTodayCount: number;
  notScannedTodayCount: number;
  scannedNotOnListCount: number;
  completionPercent: number;
  inventoryFileName: string | null;
  missingToday: AuditVehicleRef[];
  scannedNotOnList: AuditVehicleRef[];
  scannedToday: AuditVehicleRef[];
};

export type LotVehicle = {
  id: string;
  vinSuffix: string;
  model: string;
  color: string;
  daysOnLot: number | null;
  miles: number | null;
  year: number | null;
  latitude: number | null;
  longitude: number | null;
  lastScannedAt: string | null;
  scannedToday: boolean;
  lotStatus: LotStatus;
};

export type ScannedVehicle = {
  id: string;
  vinSuffix: string;
  vin: string | null;
  model: string;
  color: string;
  year: number | null;
  latitude: number;
  longitude: number;
  scannedAt: string;
  matched: boolean;
  scanCount: number;
  lotStatus: LotStatus;
  inventoryItemId: string | null;
};

export type VehicleSearchResult = {
  kind: "scanned" | "inventory";
  id: string | null;
  vin: string | null;
  vinSuffix: string;
  model: string;
  color: string;
  scannedAt?: string;
  latitude?: number | null;
  longitude?: number | null;
};

export type ParseResult = {
  items: InventoryItem[];
  rawTextPreview: string;
  totalLines: number;
};
