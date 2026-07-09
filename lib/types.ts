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

export type ParseResult = {
  items: InventoryItem[];
  rawTextPreview: string;
  totalLines: number;
};
