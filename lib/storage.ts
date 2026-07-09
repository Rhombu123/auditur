import type { InventorySnapshot, ScanRecord } from "./types";

const INVENTORY_KEY = "auditur:inventory";
const SCANS_KEY = "auditur:scans";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function saveInventory(snapshot: InventorySnapshot): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(INVENTORY_KEY, JSON.stringify(snapshot));
}

export function loadInventory(): InventorySnapshot | null {
  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(INVENTORY_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as InventorySnapshot;
  } catch {
    return null;
  }
}

export function matchInventoryItem(vinSuffix: string) {
  const inventory = loadInventory();
  if (!inventory) {
    return { inventory: null, matchedItem: null };
  }

  const normalized = vinSuffix.toUpperCase();
  const matchedItem =
    inventory.items.find((item) => item.vinSuffix.toUpperCase() === normalized) ??
    null;

  return { inventory, matchedItem };
}

export function loadScans(): ScanRecord[] {
  if (!canUseStorage()) {
    return [];
  }

  const raw = window.localStorage.getItem(SCANS_KEY);
  if (!raw) {
    return [];
  }

  try {
    return JSON.parse(raw) as ScanRecord[];
  } catch {
    return [];
  }
}

export function saveScan(record: ScanRecord): void {
  if (!canUseStorage()) {
    return;
  }

  const existing = loadScans();
  window.localStorage.setItem(
    SCANS_KEY,
    JSON.stringify([record, ...existing].slice(0, 100)),
  );
}

export function clearScans(): void {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(SCANS_KEY);
}
