import type { AuditVehicleRef, TodayAuditSummary } from "@/lib/types";
import { isScannedToday } from "@/lib/geo";

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

  const inventoryBySuffix = new Map(
    input.inventoryItems.map((item) => [item.vinSuffix.toUpperCase(), item]),
  );

  const latestScanTodayBySuffix = new Map<
    string,
    (typeof input.scansToday)[number]
  >();

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
  const notScannedTodayCount = missingToday.length;
  const scannedNotOnListCount = scannedNotOnList.length;
  const completionPercent =
    expectedCount > 0 ? Math.round((scannedTodayCount / expectedCount) * 100) : 0;

  scannedToday.sort((a, b) => a.vinSuffix.localeCompare(b.vinSuffix));
  missingToday.sort((a, b) => a.vinSuffix.localeCompare(b.vinSuffix));
  scannedNotOnList.sort((a, b) => a.vinSuffix.localeCompare(b.vinSuffix));

  return {
    expectedCount,
    scannedTodayCount,
    notScannedTodayCount,
    scannedNotOnListCount,
    completionPercent,
    inventoryFileName: input.inventoryFileName,
    missingToday,
    scannedNotOnList,
    scannedToday,
  };
}
