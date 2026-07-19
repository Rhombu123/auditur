export type ImportFileFormat = "pdf" | "csv";
export type ImportMethod = "manual";

export type InventoryItem = {
  id?: string;
  vin?: string | null;
  vinSuffix: string;
  stockNumber?: string | null;
  make?: string | null;
  model: string;
  color: string;
  sourceStatus?: string | null;
  daysOnLot: number | null;
  miles?: number | null;
  year?: number | null;
};

export type InventoryImportSummary = {
  uploadId?: string;
  fileName: string;
  uploadedAt: string;
  itemCount: number;
  items: InventoryItem[];
  fileFormat: ImportFileFormat;
  sourceSystem: string;
  importMethod: ImportMethod;
  detectedColumns: string[];
  warnings: string[];
  parserMetadata: Record<string, unknown>;
};

export type InventoryUploadLog = {
  id: string;
  fileName: string;
  uploadedAt: string;
  itemCount: number;
  isCurrent: boolean;
  hasStoredPdf: boolean;
  fileFormat?: ImportFileFormat;
  sourceSystem?: string;
  importMethod?: ImportMethod;
  parserMetadata?: Record<string, unknown>;
  warnings: string[];
  archivedAt: string | null;
  scanCount: number;
  lastUsedAt: string | null;
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
  fileFormat?: ImportFileFormat;
  sourceSystem?: string;
  warnings?: string[];
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
