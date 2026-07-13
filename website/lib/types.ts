export type InventoryItem = {
  vinSuffix: string;
  model: string;
  color: string;
  daysOnLot: number | null;
};

export type InventoryUploadLog = {
  id: string;
  fileName: string;
  uploadedAt: string;
  itemCount: number;
  isCurrent: boolean;
  hasStoredPdf: boolean;
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

export type LotZone = {
  id: string;
  name: string;
  polygons: { latitude: number; longitude: number }[][];
  fillColor: string;
  strokeColor: string;
};

export type ScanFeedItem = {
  id: string;
  vinSuffix: string;
  model: string;
  color: string;
  scannedAt: string;
  scannerEmail: string | null;
  zoneName: string | null;
  matched: boolean;
};

export type ZoneStat = {
  id: string;
  name: string;
  strokeColor: string;
  count: number;
};

export type DashboardData = {
  audit: TodayAuditSummary | null;
  recentScans: ScanFeedItem[];
  uploadLog: InventoryUploadLog[];
  zoneStats: ZoneStat[];
  totalPinnedVehicles: number;
};
