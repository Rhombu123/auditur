"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

import { getCurrentLocation, mapsUrl } from "@/lib/geolocation";
import { matchInventoryItem, saveScan } from "@/lib/storage";
import type { ScanRecord } from "@/lib/types";
import { extractVin, extractVinSuffix, formatVin } from "@/lib/vin";

type ScannerStatus =
  | "idle"
  | "starting"
  | "scanning"
  | "processing"
  | "error";

type VinScannerProps = {
  onScan?: (record: ScanRecord) => void;
};

const SCAN_COOLDOWN_MS = 2500;

const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.PDF_417,
];

export function VinScanner({ onScan }: VinScannerProps) {
  const readerId = useId().replace(/:/g, "");
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lastScanRef = useRef<{ value: string; at: number } | null>(null);
  const processingRef = useRef(false);

  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [latestScan, setLatestScan] = useState<ScanRecord | null>(null);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) {
      return;
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
      scanner.clear();
    } catch {
      // Scanner may already be stopped when the component unmounts.
    } finally {
      scannerRef.current = null;
    }
  }, []);

  const handleSuccessfulScan = useCallback(
    async (rawValue: string) => {
      if (processingRef.current) {
        return;
      }

      const now = Date.now();
      const lastScan = lastScanRef.current;
      if (
        lastScan &&
        lastScan.value === rawValue &&
        now - lastScan.at < SCAN_COOLDOWN_MS
      ) {
        return;
      }

      processingRef.current = true;
      lastScanRef.current = { value: rawValue, at: now };
      setStatus("processing");
      setError(null);

      try {
        const vinSuffix = extractVinSuffix(rawValue);
        if (!vinSuffix) {
          throw new Error("Scanned code is not a valid VIN.");
        }

        const vin = extractVin(rawValue);
        const position = await getCurrentLocation();
        const { matchedItem } = matchInventoryItem(vinSuffix);

        const record: ScanRecord = {
          id: crypto.randomUUID(),
          vin: vin ? formatVin(vin) : null,
          vinSuffix,
          scannedAt: new Date().toISOString(),
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: position.accuracy,
          matchedItem,
          rawValue,
        };

        saveScan(record);
        setLatestScan(record);
        onScan?.(record);
        setStatus("scanning");
      } catch (scanError) {
        setError(
          scanError instanceof Error
            ? scanError.message
            : "Failed to process the scanned VIN.",
        );
        setStatus("scanning");
      } finally {
        processingRef.current = false;
      }
    },
    [onScan],
  );

  const startScanner = useCallback(async () => {
    setError(null);
    setStatus("starting");

    try {
      await stopScanner();

      const scanner = new Html5Qrcode(readerId, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      scannerRef.current = scanner;

      const cameras = await Html5Qrcode.getCameras();
      const rearCamera =
        cameras.find((camera) =>
          /back|rear|environment/i.test(camera.label),
        ) ?? cameras[cameras.length - 1];

      const cameraConfig = rearCamera
        ? rearCamera.id
        : { facingMode: "environment" };

      await scanner.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: (viewfinderWidth, viewfinderHeight) => {
            const width = Math.min(viewfinderWidth * 0.9, 320);
            const height = Math.min(viewfinderHeight * 0.35, 140);
            return { width, height };
          },
          aspectRatio: 1.7777778,
        },
        (decodedText) => {
          void handleSuccessfulScan(decodedText);
        },
        () => {
          // No-op: scan failures are expected while searching for a barcode.
        },
      );

      setStatus("scanning");
    } catch (startError) {
      setStatus("error");
      setError(
        startError instanceof Error
          ? startError.message
          : "Unable to start the camera. Check permissions and try again.",
      );
      await stopScanner();
    }
  }, [handleSuccessfulScan, readerId, stopScanner]);

  useEffect(() => {
    void startScanner();

    return () => {
      void stopScanner();
    };
  }, [startScanner, stopScanner]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-black shadow-sm">
        <div className="relative">
          <div id={readerId} className="vin-scanner min-h-[320px] w-full" />

          {status === "starting" || status === "processing" ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 px-6 text-center text-sm font-medium text-white">
              {status === "starting"
                ? "Starting camera..."
                : "VIN detected. Capturing GPS location..."}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/10 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">
          <span>
            {status === "scanning"
              ? "Point at the VIN barcode on the door jamb or windshield."
              : status === "error"
                ? "Camera unavailable"
                : "Preparing scanner"}
          </span>
          <button
            type="button"
            onClick={() => void startScanner()}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-zinc-950"
          >
            Restart
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {latestScan ? (
        <section
          className={`rounded-3xl border px-5 py-5 shadow-sm ${
            latestScan.matchedItem
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-600">
                Latest Scan
              </p>
              <p className="font-mono text-2xl font-semibold tracking-[0.18em] text-zinc-950">
                {latestScan.vinSuffix}
              </p>
              {latestScan.vin ? (
                <p className="font-mono text-sm text-zinc-600">{latestScan.vin}</p>
              ) : null}
            </div>

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                latestScan.matchedItem
                  ? "bg-emerald-600 text-white"
                  : "bg-amber-500 text-white"
              }`}
            >
              {latestScan.matchedItem ? "Matched" : "Not in inventory"}
            </span>
          </div>

          {latestScan.matchedItem ? (
            <dl className="mt-4 grid gap-3 rounded-2xl bg-white/80 p-4 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-zinc-500">Model</dt>
                <dd className="font-medium text-zinc-900">
                  {latestScan.matchedItem.model}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Color</dt>
                <dd className="font-medium text-zinc-900">
                  {latestScan.matchedItem.color}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500">Days on Lot</dt>
                <dd className="font-medium text-zinc-900">
                  {latestScan.matchedItem.daysOnLot ?? "—"}
                </dd>
              </div>
            </dl>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-white/80 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-zinc-900">GPS pinned</p>
              <p className="font-mono text-xs text-zinc-600">
                {latestScan.latitude.toFixed(6)}, {latestScan.longitude.toFixed(6)}
                {latestScan.accuracy
                  ? ` · ±${Math.round(latestScan.accuracy)}m`
                  : ""}
              </p>
            </div>

            <a
              href={mapsUrl(latestScan.latitude, latestScan.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-zinc-950 px-4 py-2 text-sm font-medium text-white"
            >
              Open in Maps
            </a>
          </div>
        </section>
      ) : null}
    </div>
  );
}
