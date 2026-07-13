import type { AuditVehicleRef, TodayAuditSummary } from "@/lib/types";

function isScannedToday(scannedAt: string): boolean {
  const scanned = new Date(scannedAt);
  const now = new Date();
  return (
    scanned.getFullYear() === now.getFullYear() &&
    scanned.getMonth() === now.getMonth() &&
    scanned.getDate() === now.getDate()
  );
}

export function buildTodayAuditSummary(input: {
  inventoryFileName: string | null;
  inventoryItems: { vinSuffix: string; model: string; color: string }[];
  scansToday: {
    vinSuffix: string;
    model: string | null;
    color: string | null;
    scannedAt: string;
    scannerEmail?: string | null;
    matched: boolean;
  }[];
}): TodayAuditSummary {
  const expectedSet = new Set(
    input.inventoryItems.map((item) => item.vinSuffix.toUpperCase()),
  );

  const latestScanTodayBySuffix = new Map<string, (typeof input.scansToday)[number]>();

  for (const scan of input.scansToday) {
    if (!isScannedToday(scan.scannedAt)) continue;
    const key = scan.vinSuffix.toUpperCase();
    const existing = latestScanTodayBySuffix.get(key);
    if (!existing || new Date(scan.scannedAt) > new Date(existing.scannedAt)) {
      latestScanTodayBySuffix.set(key, scan);
    }
  }

  const scannedToday: AuditVehicleRef[] = [];
  const scannedNotOnList: AuditVehicleRef[] = [];

  for (const scan of latestScanTodayBySuffix.values()) {
    const ref: AuditVehicleRef = {
      vinSuffix: scan.vinSuffix.toUpperCase(),
      model: scan.model ?? `Vehicle ${scan.vinSuffix}`,
      color: scan.color ?? "Unknown",
      scannedAt: scan.scannedAt,
      scannerEmail: scan.scannerEmail ?? null,
    };
    scannedToday.push(ref);
    if (!expectedSet.has(scan.vinSuffix.toUpperCase())) {
      scannedNotOnList.push(ref);
    }
  }

  const missingToday: AuditVehicleRef[] = input.inventoryItems
    .filter((item) => !latestScanTodayBySuffix.has(item.vinSuffix.toUpperCase()))
    .map((item) => ({
      vinSuffix: item.vinSuffix.toUpperCase(),
      model: item.model,
      color: item.color,
    }));

  const expectedCount = input.inventoryItems.length;
  const scannedTodayCount = scannedToday.filter((v) =>
    expectedSet.has(v.vinSuffix),
  ).length;

  return {
    expectedCount,
    scannedTodayCount,
    notScannedTodayCount: missingToday.length,
    scannedNotOnListCount: scannedNotOnList.length,
    completionPercent:
      expectedCount > 0 ? Math.round((scannedTodayCount / expectedCount) * 100) : 0,
    inventoryFileName: input.inventoryFileName,
    missingToday,
    scannedNotOnList,
    scannedToday,
  };
}
