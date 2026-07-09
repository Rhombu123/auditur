"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { VinScanner } from "@/components/vin-scanner";
import { clearScansOnServer, fetchInventory, fetchScans } from "@/lib/api-client";
import { mapsUrl } from "@/lib/geolocation";
import type { ScanRecord } from "@/lib/types";

export function ScanPage() {
  const [inventoryCount, setInventoryCount] = useState(0);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const [inventory, scanRecords] = await Promise.all([
          fetchInventory(),
          fetchScans(),
        ]);
        setInventoryCount(inventory?.items.length ?? 0);
        setScans(scanRecords);
      } catch (error) {
        setLoadError(
          error instanceof Error ? error.message : "Failed to load scan data.",
        );
      }
    }

    void loadData();
  }, []);

  const onScan = useCallback((record: ScanRecord) => {
    setScans((current) => [record, ...current.filter((item) => item.id !== record.id)]);
  }, []);

  async function handleClearScans() {
    await clearScansOnServer();
    setScans([]);
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 pb-10 sm:px-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-700">
          Lot Scanner
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
          Scan VIN Barcode
        </h1>
        <p className="text-base leading-7 text-zinc-600">
          Scan a vehicle barcode, match it against your uploaded inventory, and
          automatically capture GPS coordinates for the pin.
        </p>
      </header>

      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {loadError}
        </div>
      ) : null}

      {inventoryCount === 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          No inventory loaded yet.{" "}
          <Link href="/" className="font-semibold underline">
            Upload a PDF first
          </Link>{" "}
          so scans can be matched to models and colors.
        </div>
      ) : (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {inventoryCount} vehicles loaded and ready to match.
        </div>
      )}

      <VinScanner onScan={onScan} />

      {scans.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-950">Recent Pins</h2>
            <button
              type="button"
              onClick={() => void handleClearScans()}
              className="text-sm font-medium text-zinc-500 hover:text-zinc-800"
            >
              Clear
            </button>
          </div>

          <div className="space-y-3">
            {scans.map((scan) => (
              <article
                key={scan.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-lg font-semibold tracking-[0.16em] text-zinc-950">
                      {scan.vinSuffix}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {new Date(scan.scannedAt).toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      scan.matchedItem
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {scan.matchedItem ? "Matched" : "Unknown"}
                  </span>
                </div>

                {scan.matchedItem ? (
                  <p className="mt-2 text-sm text-zinc-700">
                    {scan.matchedItem.model} · {scan.matchedItem.color}
                  </p>
                ) : null}

                <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                  <p className="font-mono text-xs text-zinc-500">
                    {scan.latitude.toFixed(5)}, {scan.longitude.toFixed(5)}
                  </p>
                  <a
                    href={mapsUrl(scan.latitude, scan.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-emerald-700"
                  >
                    Map
                  </a>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
