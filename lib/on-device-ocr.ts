import { buildPhotoScanTargets, type ScanMode } from "@/lib/barcode-scan";
import { isExpoGo } from "@/lib/dev-build";
import { extractVin, isValidVinCheckDigit, parseScanPayload } from "@/lib/vin";

export type OnDeviceOcrResult = {
  lines: string[];
  rawText: string | null;
  vin: string | null;
  vinSuffix: string | null;
  parsed: ReturnType<typeof parseScanPayload>;
};

type TextExtractorModule = typeof import("expo-text-extractor");

let textExtractorModule: TextExtractorModule | null | undefined;

function getTextExtractorModule(): TextExtractorModule | null {
  if (isExpoGo()) return null;

  if (textExtractorModule !== undefined) {
    return textExtractorModule;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("expo-text-extractor") as TextExtractorModule;
    textExtractorModule = mod.isSupported ? mod : null;
    return textExtractorModule;
  } catch {
    textExtractorModule = null;
    return null;
  }
}

export function isOnDeviceOcrSupported(): boolean {
  return Boolean(getTextExtractorModule()?.isSupported);
}

export async function ocrVinFromPhoto(
  photoUri: string,
  photoWidth: number,
  photoHeight: number,
  mode: ScanMode = "barcode",
): Promise<OnDeviceOcrResult> {
  const mod = getTextExtractorModule();
  if (!mod) {
    throw new Error(
      isExpoGo()
        ? "Printed text scan needs the Auditur dev build — not Expo Go."
        : "On-device text scan is unavailable. Run: npx expo run:ios",
    );
  }

  const imageUris = await buildPhotoScanTargets(photoUri, photoWidth, photoHeight, mode);
  const lineSet = new Set<string>();
  let best: OnDeviceOcrResult | null = null;

  for (const uri of imageUris) {
    const extracted = await mod.extractTextFromImage(uri);
    for (const line of extracted) {
      const trimmed = line.trim();
      if (trimmed) lineSet.add(trimmed);
    }

    const lines = [...lineSet];
    const rawText = lines.join("\n").trim() || null;
    const parsed = parseScanPayload(rawText, ...lines);
    const vin = parsed?.vin ?? (rawText ? extractVin(rawText) : null);
    const vinSuffix = parsed?.vinSuffix ?? (vin ? vin.slice(-6) : null);
    const candidate = { lines, rawText, vin, vinSuffix, parsed };

    if (parsed?.vin && isValidVinCheckDigit(parsed.vin)) {
      return candidate;
    }

    if (!best || scoreOcrResult(candidate) > scoreOcrResult(best)) {
      best = candidate;
    }
  }

  return (
    best ?? {
      lines: [],
      rawText: null,
      vin: null,
      vinSuffix: null,
      parsed: null,
    }
  );
}

function scoreOcrResult(result: OnDeviceOcrResult): number {
  let score = result.lines.length;
  if (result.vin) score += 100;
  if (result.parsed?.vin) score += 200;
  return score;
}
