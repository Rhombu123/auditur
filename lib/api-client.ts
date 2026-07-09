import type {
  InventoryItem,
  InventorySnapshot,
  LotStatus,
  LotVehicle,
  ScanRecord,
} from "@/lib/types";

export async function fetchInventory(): Promise<InventorySnapshot | null> {
  const response = await fetch("/api/inventory", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load inventory.");
  }

  const data = (await response.json()) as { inventory: InventorySnapshot | null };
  return data.inventory;
}

export async function saveInventoryToServer(
  fileName: string,
  items: InventoryItem[],
): Promise<InventorySnapshot> {
  const response = await fetch("/api/inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileName, items }),
  });

  const data = (await response.json()) as
    | { inventory: InventorySnapshot }
    | { error: string };

  if (!response.ok || !("inventory" in data)) {
    throw new Error("error" in data ? data.error : "Failed to save inventory.");
  }

  return data.inventory;
}

export async function fetchScans(): Promise<ScanRecord[]> {
  const response = await fetch("/api/scans", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load scans.");
  }

  const data = (await response.json()) as { scans: ScanRecord[] };
  return data.scans;
}

export async function saveScanToServer(
  record: Omit<ScanRecord, "id" | "scannedAt"> & { scannedAt?: string },
): Promise<ScanRecord> {
  const response = await fetch("/api/scans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(record),
  });

  const data = (await response.json()) as { scan: ScanRecord } | { error: string };
  if (!response.ok || !("scan" in data)) {
    throw new Error("error" in data ? data.error : "Failed to save scan.");
  }

  return data.scan;
}

export async function clearScansOnServer(): Promise<void> {
  const response = await fetch("/api/scans", { method: "DELETE" });
  if (!response.ok) {
    throw new Error("Failed to clear scans.");
  }
}

export async function matchInventoryItem(vinSuffix: string): Promise<{
  inventory: InventorySnapshot | null;
  matchedItem: InventoryItem | null;
}> {
  const inventory = await fetchInventory();
  if (!inventory) {
    return { inventory: null, matchedItem: null };
  }

  const normalized = vinSuffix.toUpperCase();
  const matchedItem =
    inventory.items.find((item) => item.vinSuffix.toUpperCase() === normalized) ??
    null;

  return { inventory, matchedItem };
}

export type LotResponse = {
  vehicles: LotVehicle[];
  pinnedCount: number;
  scannedTodayCount: number;
};

export async function fetchLotVehicles(): Promise<LotResponse> {
  const response = await fetch("/api/lot", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Failed to load lot vehicles.");
  }

  return (await response.json()) as LotResponse;
}

export async function markVehicleRemoved(
  itemId: string,
  lotStatus: Exclude<LotStatus, "active">,
): Promise<LotVehicle[]> {
  const response = await fetch("/api/lot", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, lotStatus }),
  });

  const data = (await response.json()) as
    | { vehicles: LotVehicle[] }
    | { error: string };

  if (!response.ok || !("vehicles" in data)) {
    throw new Error("error" in data ? data.error : "Failed to update vehicle.");
  }

  return data.vehicles;
}
