export type ScannedVehicleRow = {
  id: string;
  vinSuffix: string;
  model: string;
  color: string;
  scannedAt: string;
  latitude: number;
  longitude: number;
  matched: boolean;
  scannerEmail: string | null;
};
