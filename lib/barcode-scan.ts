import * as ImageManipulator from "expo-image-manipulator";
import { Camera, type BarcodeScanningResult, type BarcodeType } from "expo-camera";

export type ScanMode = "barcode" | "qr";

export const ONE_D_BARCODE_TYPES = new Set<BarcodeType>([
  "codabar",
  "code39",
  "code93",
  "code128",
  "ean13",
  "ean8",
  "itf14",
  "upc_a",
  "upc_e",
]);

export const ALL_BARCODE_TYPES: BarcodeType[] = [
  "aztec",
  "codabar",
  "code39",
  "code93",
  "code128",
  "datamatrix",
  "ean13",
  "ean8",
  "itf14",
  "pdf417",
  "qr",
  "upc_a",
  "upc_e",
];

export type GuideLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export function getGuideLayout(
  mode: ScanMode,
  screenWidth: number,
  screenHeight: number,
): GuideLayout {
  if (mode === "qr") {
    const size = Math.min(screenWidth * 0.72, screenHeight * 0.36, 320);
    return {
      left: (screenWidth - size) / 2,
      top: (screenHeight - size) / 2,
      width: size,
      height: size,
    };
  }

  const width = Math.min(screenWidth * 0.94, 400);
  const height = Math.max(110, Math.floor(width * 0.34));
  return {
    left: (screenWidth - width) / 2,
    top: (screenHeight - height) / 2,
    width,
    height,
  };
}

export function getScanModeHint(mode: ScanMode): string {
  if (mode === "qr") {
    return "QR: hold 8–12 in back, whole code inside the square";
  }
  return "Barcode: hold 8–12 in back, keep lines level inside the box";
}

function centerCrop(
  photoWidth: number,
  photoHeight: number,
  widthRatio: number,
  heightRatio: number,
) {
  const cropWidth = Math.floor(photoWidth * widthRatio);
  const cropHeight = Math.floor(photoHeight * heightRatio);
  return {
    originX: Math.max(0, Math.floor((photoWidth - cropWidth) / 2)),
    originY: Math.max(0, Math.floor((photoHeight - cropHeight) / 2)),
    width: cropWidth,
    height: cropHeight,
  };
}

async function enhanceForScan(uri: string, crop: ReturnType<typeof centerCrop>) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ crop }, { resize: { width: 1800 } }],
    { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
  );
  return result.uri;
}

export async function buildPhotoScanTargets(
  photoUri: string,
  photoWidth: number,
  photoHeight: number,
  mode: ScanMode,
): Promise<string[]> {
  const targets = new Set<string>([photoUri]);

  if (mode === "qr") {
    const tight = centerCrop(photoWidth, photoHeight, 0.72, 0.72);
    const padded = centerCrop(photoWidth, photoHeight, 0.85, 0.85);
    targets.add(await enhanceForScan(photoUri, tight));
    targets.add(await enhanceForScan(photoUri, padded));
    return [...targets];
  }

  const band = centerCrop(photoWidth, photoHeight, 0.96, 0.3);
  const wideBand = centerCrop(photoWidth, photoHeight, 0.98, 0.38);
  targets.add(await enhanceForScan(photoUri, band));
  targets.add(await enhanceForScan(photoUri, wideBand));
  return [...targets];
}

export async function scanPhotoForBarcodes(
  photoUri: string,
  photoWidth: number,
  photoHeight: number,
  mode: ScanMode,
  barcodeTypes: BarcodeType[] = ALL_BARCODE_TYPES,
): Promise<BarcodeScanningResult[]> {
  const targets = await buildPhotoScanTargets(photoUri, photoWidth, photoHeight, mode);
  const merged = new Map<string, BarcodeScanningResult>();

  for (const target of targets) {
    const results = await Camera.scanFromURLAsync(target, barcodeTypes);
    for (const result of results) {
      const key = `${result.type}:${result.data ?? result.raw ?? ""}`;
      if (!merged.has(key)) {
        merged.set(key, result);
      }
    }
  }

  return [...merged.values()];
}

export function isOneDBarcodeType(type: string | undefined): boolean {
  return type != null && ONE_D_BARCODE_TYPES.has(type as BarcodeType);
}

export function shouldAutoCapturePhoto(
  result: Pick<BarcodeScanningResult, "type" | "data" | "raw">,
  mode: ScanMode,
  parsedVinFound: boolean,
): boolean {
  if (parsedVinFound) return false;
  if (mode === "qr" && result.type === "qr") return true;
  if (mode === "barcode" && isOneDBarcodeType(result.type)) return true;
  const payload = result.data?.trim() || result.raw?.trim();
  return Boolean(payload);
}
