export type InventoryItem = {
  vinSuffix: string;
  model: string;
  color: string;
  daysOnLot: number | null;
};

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

export type ParseResult = {
  items: InventoryItem[];
  rawTextPreview: string;
  totalLines: number;
};
