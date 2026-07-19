import Ionicons from "@expo/vector-icons/Ionicons";
import {
  CameraView,
  type BarcodeScanningResult,
  type CameraCapturedPicture,
  useCameraPermissions,
} from "expo-camera";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

import {
  fetchLatestScanRow,
  fetchTodayAudit,
  matchInventoryItem,
  resolveVehicleDetails,
  saveScan,
} from "@/lib/mobile-api";
import { playScanSuccessHaptic } from "@/lib/haptic-preferences";
import {
  ALL_BARCODE_TYPES,
  getGuideLayout,
  getScanModeHint,
  scanPhotoForBarcodes,
  shouldAutoCapturePhoto,
  type ScanMode,
} from "@/lib/barcode-scan";
import {
  extractVin,
  formatVin,
  isValidVinCheckDigit,
  parseScanPayload,
} from "@/lib/vin";
import {
  ScanResultModal,
  type ScanResultSummary,
} from "@/components/scan-result-modal";
import { ManualVinModal } from "@/components/manual-vin-modal";
import { colors, palette, spacing } from "@/constants/theme";
import { isDevBuild } from "@/lib/dev-build";
import { useLiveMultiUserProgress } from "@/lib/live-progress";
import { clearMobileCache, MOBILE_CACHE_KEYS } from "@/lib/mobile-cache";
import { ocrVinFromPhoto } from "@/lib/on-device-ocr";

const BARCODE_COOLDOWN_MS = 1800;
const BARCODE_FEEDBACK_COOLDOWN_MS = 2500;
const AUTO_CAPTURE_COOLDOWN_MS = 4000;
const AUTO_CAPTURE_DELAY_MS = 650;
const PHOTO_BURST_COUNT = 2;
const PHOTO_BURST_GAP_MS = 200;

type CameraHandle = {
  takePictureAsync?: (options?: {
    quality?: number;
    skipProcessing?: boolean;
  }) => Promise<CameraCapturedPicture>;
  takePicture?: (options?: {
    quality?: number;
    skipProcessing?: boolean;
  }) => Promise<CameraCapturedPicture>;
};

async function capturePhoto(
  camera: CameraHandle | null,
  options: { quality: number; skipProcessing: boolean } = {
    quality: 0.72,
    skipProcessing: true,
  },
): Promise<CameraCapturedPicture | null> {
  if (!camera) return null;

  if (typeof camera.takePictureAsync === "function") {
    return camera.takePictureAsync(options);
  }

  if (typeof camera.takePicture === "function") {
    return camera.takePicture(options);
  }

  return null;
}

export default function ScanCameraScreen() {
  const router = useRouter();
  const devBuild = isDevBuild();
  const cameraRef = useRef<CameraHandle | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scanMode, setScanMode] = useState<ScanMode>("barcode");
  const [status, setStatus] = useState(getScanModeHint("barcode"));
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [scanModalLoading, setScanModalLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResultSummary | null>(null);
  const [scanModalError, setScanModalError] = useState<string | null>(null);
  const [manualVinVisible, setManualVinVisible] = useState(false);
  const [scanProgress, setScanProgress] = useState<{
    scanned: number;
    expected: number;
  } | null>(null);
  const processingRef = useRef(false);
  const lastScanRef = useRef<{ vinSuffix: string; at: number } | null>(null);
  const lastBarcodeFeedbackRef = useRef<{ key: string; at: number } | null>(null);
  const captureInFlightRef = useRef(false);
  const autoCaptureTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoCaptureRef = useRef(0);

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const boundaryStyle = getGuideLayout(scanMode, screenWidth, screenHeight);

  const refreshScanProgress = useCallback(async () => {
    try {
      const audit = await fetchTodayAudit();
      setScanProgress(
        audit
          ? { scanned: audit.scannedTodayCount, expected: audit.expectedCount }
          : null,
      );
    } catch {
      // Scanning stays available when progress cannot be refreshed.
    }
  }, []);

  useEffect(() => {
    void refreshScanProgress();
  }, [refreshScanProgress]);

  useLiveMultiUserProgress({ onScanChange: refreshScanProgress });

  const completeScan = useCallback(
    async (parsed: { rawValue: string; vin: string | null; vinSuffix: string }) => {
      if (processingRef.current) return;
      processingRef.current = true;
      setProcessing(true);
      setError(null);
      setScanResult(null);
      setScanModalError(null);
      setScanModalLoading(true);
      setScanModalVisible(true);
      setStatus("Saving scan…");
      try {
        const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
        if (locStatus !== "granted") {
          throw new Error("Location permission is required to pin scans.");
        }

        let position = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if ((position.coords.accuracy ?? Number.POSITIVE_INFINITY) > 50) {
          const refinedPosition = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Highest,
          });
          if (
            (refinedPosition.coords.accuracy ?? Number.POSITIVE_INFINITY) <
            (position.coords.accuracy ?? Number.POSITIVE_INFINITY)
          ) {
            position = refinedPosition;
          }
        }
        if ((position.coords.accuracy ?? Number.POSITIVE_INFINITY) > 75) {
          throw new Error(
            "GPS accuracy is too low to place this vehicle. Move into an open area and try again.",
          );
        }

        const formattedVin = parsed.vin
          ? formatVin(parsed.vin)
          : extractVin(parsed.rawValue)
            ? formatVin(extractVin(parsed.rawValue)!)
            : null;
        const vinSuffix = parsed.vinSuffix.toUpperCase();

        const existing = await fetchLatestScanRow(vinSuffix);

        setStatus(existing ? "Updating vehicle location…" : "Looking up vehicle…");
        const { vehicle, inventoryMatched } = await resolveVehicleDetails(
          formattedVin,
          vinSuffix,
          existing,
        );

        const record = await saveScan({
          vin: formattedVin ?? existing?.vin ?? null,
          vinSuffix,
          rawValue: parsed.rawValue,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          vehicle,
          inventoryMatched,
        });
        void playScanSuccessHaptic().catch(() => undefined);
        await Promise.all([
          clearMobileCache(MOBILE_CACHE_KEYS.audit),
          clearMobileCache(MOBILE_CACHE_KEYS.vehicles),
        ]);
        void refreshScanProgress();

        setScanResult({
          vin: formattedVin ?? existing?.vin ?? null,
          vinSuffix,
          vehicle,
          inventoryMatched,
          isRescan: record.isRescan,
          scanId: record.id,
        });
        setStatus(
          record.isRescan
            ? `Updated location · ${vehicle.model}`
            : vehicle.model,
        );
      } catch (scanError) {
        const message = scanError instanceof Error ? scanError.message : "Scan failed.";
        setScanModalError(message);
        setError(message);
        setStatus("Scan failed — try again");
        processingRef.current = false;
        setProcessing(false);
      } finally {
        setScanModalLoading(false);
      }
    },
    [refreshScanProgress],
  );

  const dismissScanModal = useCallback(() => {
    setScanModalVisible(false);
    setScanModalLoading(false);
    setScanResult(null);
    setScanModalError(null);
    processingRef.current = false;
    setProcessing(false);
    setStatus(getScanModeHint(scanMode));
  }, [scanMode]);

  const handleViewScannedVehicle = useCallback(() => {
    if (!scanResult) return;
    const { vinSuffix, scanId } = scanResult;
    dismissScanModal();
    router.replace({
      pathname: "/vehicle/[vinSuffix]",
      params: { vinSuffix, highlightId: scanId },
    });
  }, [dismissScanModal, router, scanResult]);

  const tryScanPayload = useCallback(
    async (
      parsed: { rawValue: string; vin: string | null; vinSuffix: string },
      source: string,
    ) => {
      if (processing) return false;

      const vinSuffix = parsed.vinSuffix.toUpperCase();
      const needsInventoryConfirmation =
        !parsed.vin || !isValidVinCheckDigit(parsed.vin);
      if (needsInventoryConfirmation && source !== "manual entry") {
        const { inventory, matchedItem } = await matchInventoryItem(vinSuffix);
        if (!inventory) {
          setStatus("Upload a price list first, or enter the VIN manually");
          return false;
        }
        if (!matchedItem) {
          setStatus("Code rejected — it does not match a vehicle on the price list");
          return false;
        }
      }

      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.vinSuffix === vinSuffix && now - last.at < BARCODE_COOLDOWN_MS) {
        return false;
      }

      lastScanRef.current = { vinSuffix, at: now };
      setStatus(`Found VIN via ${source}`);
      await completeScan({ ...parsed, vinSuffix });
      return true;
    },
    [completeScan, processing],
  );

  const showBarcodeFeedback = useCallback(
    (
      result: Pick<BarcodeScanningResult, "type" | "data" | "raw">,
      source: "live" | "photo",
      parsed: ReturnType<typeof parseScanPayload>,
    ) => {
      const barcodeType = result.type ?? "unknown";
      const payload = result.data?.trim() || result.raw?.trim() || "";
      const key = `${source}:${barcodeType}:${payload}`;
      const now = Date.now();
      const last = lastBarcodeFeedbackRef.current;
      if (last && last.key === key && now - last.at < BARCODE_FEEDBACK_COOLDOWN_MS) {
        return;
      }
      lastBarcodeFeedbackRef.current = { key, at: now };

      if (parsed) {
        setStatus(`Barcode detected — reading VIN…`);
      } else if (payload) {
        setStatus(`Barcode detected — no VIN in payload`);
      } else {
        setStatus(`Barcode detected — empty payload`);
      }
    },
    [],
  );

  const processBarcodeResults = useCallback(
    async (
      results: BarcodeScanningResult[],
      source: "live" | "photo",
    ): Promise<boolean> => {
      if (results.length === 0) return false;

      for (const result of results) {
        const parsed = parseScanPayload(result.data, result.raw);
        showBarcodeFeedback(result, source, parsed);
        if (parsed && (await tryScanPayload(parsed, `${source} ${result.type}`))) {
          return true;
        }
      }

      return false;
    },
    [showBarcodeFeedback, tryScanPayload],
  );

  function switchScanMode(mode: ScanMode) {
    setScanMode(mode);
    setStatus(getScanModeHint(mode));
  }

  const runOcrFromPhoto = useCallback(
    async (
      photoUri: string,
      photoWidth: number,
      photoHeight: number,
      manual: boolean,
    ): Promise<boolean> => {
      const result = await ocrVinFromPhoto(photoUri, photoWidth, photoHeight, scanMode);

      if (result.parsed && (await tryScanPayload(result.parsed, "on-device text"))) {
        return true;
      }

      if (manual) {
        if (result.lines.length === 0) {
          setStatus("No text detected — center printed VIN in the green box");
        } else if (result.vin) {
          setStatus(`Read text but VIN unclear — saw ${result.vin}`);
        } else {
          setStatus("Text seen — no VIN found. Align all 17 characters in the box");
        }
      }
      return false;
    },
    [scanMode, tryScanPayload],
  );

  const runOcrTick = useCallback(async () => {
    if (!devBuild || processing || !cameraReady || captureInFlightRef.current) return;

    try {
      captureInFlightRef.current = true;
      setStatus("Reading printed VIN on device…");

      const photo = await capturePhoto(cameraRef.current, {
        quality: 0.98,
        skipProcessing: true,
      });
      if (!photo?.uri || !photo.width || !photo.height) {
        setStatus("Could not capture photo — try again");
        return;
      }

      await runOcrFromPhoto(photo.uri, photo.width, photo.height, true);
    } catch (ocrError) {
      setStatus(
        ocrError instanceof Error ? ocrError.message : "On-device text scan failed",
      );
    } finally {
      captureInFlightRef.current = false;
    }
  }, [cameraReady, devBuild, processing, runOcrFromPhoto]);

  const runBarcodeFromPhoto = useCallback(
    async (options?: { auto?: boolean }) => {
      if (processing || !cameraReady || captureInFlightRef.current) return;

      try {
        captureInFlightRef.current = true;
        setError(null);
        setStatus(
          options?.auto
            ? "Auto-capture — sharpening barcode read…"
            : "Capturing barcode…",
        );

        let lastPhoto: CameraCapturedPicture | null = null;

        for (let attempt = 0; attempt < PHOTO_BURST_COUNT; attempt += 1) {
          if (attempt > 0) {
            await new Promise((resolve) => setTimeout(resolve, PHOTO_BURST_GAP_MS));
          }

          const photo = await capturePhoto(cameraRef.current, {
            quality: 0.98,
            skipProcessing: true,
          });
          if (!photo?.uri || !photo.width || !photo.height) {
            continue;
          }
          lastPhoto = photo;

          const results = await scanPhotoForBarcodes(
            photo.uri,
            photo.width,
            photo.height,
            scanMode,
          );
          if (await processBarcodeResults(results, "photo")) {
            return;
          }
        }

        if (
          devBuild &&
          lastPhoto?.uri &&
          lastPhoto.width &&
          lastPhoto.height
        ) {
          setStatus("No barcode — trying printed text…");
          if (await runOcrFromPhoto(lastPhoto.uri, lastPhoto.width, lastPhoto.height, true)) {
            return;
          }
        }

        setStatus(
          scanMode === "qr"
            ? "No QR in photo — center the full square code"
            : "No barcode in photo — keep lines level in the green box",
        );
      } catch (captureError) {
        setStatus(
          captureError instanceof Error
            ? captureError.message
            : "Barcode capture failed — try again",
        );
      } finally {
        captureInFlightRef.current = false;
      }
    },
    [cameraReady, devBuild, processBarcodeResults, processing, runOcrFromPhoto, scanMode],
  );

  const scheduleAutoCapture = useCallback(() => {
    if (processing || captureInFlightRef.current || !cameraReady) return;

    const now = Date.now();
    if (now - lastAutoCaptureRef.current < AUTO_CAPTURE_COOLDOWN_MS) {
      return;
    }

    if (autoCaptureTimerRef.current) {
      clearTimeout(autoCaptureTimerRef.current);
    }

    autoCaptureTimerRef.current = setTimeout(() => {
      lastAutoCaptureRef.current = Date.now();
      void runBarcodeFromPhoto({ auto: true });
    }, AUTO_CAPTURE_DELAY_MS);
  }, [cameraReady, processing, runBarcodeFromPhoto]);

  const handleBarcode = useCallback(
    async (result: BarcodeScanningResult) => {
      const parsed = parseScanPayload(result.data, result.raw);
      const success = await processBarcodeResults([result], "live");
      if (!success && shouldAutoCapturePhoto(result, scanMode, Boolean(parsed))) {
        setStatus(
          scanMode === "barcode"
            ? "Barcode seen — auto-capturing a sharper photo…"
            : "Code seen — auto-capturing a sharper photo…",
        );
        scheduleAutoCapture();
      }
    },
    [processBarcodeResults, scanMode, scheduleAutoCapture],
  );

  const handleManualCheck = useCallback(async (vinSuffix: string) => {
    const { inventory, matchedItem } = await matchInventoryItem(vinSuffix);
    if (!inventory) return "no-inventory" as const;
    return matchedItem;
  }, []);

  const handleManualSave = useCallback(
    async (vinSuffix: string) => {
      setManualVinVisible(false);
      const success = await tryScanPayload(
        {
          rawValue: `MANUAL:${vinSuffix}`,
          vin: null,
          vinSuffix: vinSuffix.toUpperCase(),
        },
        "manual entry",
      );
      if (!success) {
        throw new Error("Could not save manual scan.");
      }
    },
    [tryScanPayload],
  );

  if (!permission) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.message}>Camera access is required to scan VINs.</Text>
        <Pressable style={styles.button} onPress={() => void requestPermission()}>
          <Text style={styles.buttonText}>Allow Camera</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={(ref) => {
          cameraRef.current = ref as CameraHandle | null;
        }}
        style={styles.camera}
        facing="back"
        enableTorch={torchOn}
        autofocus="on"
        zoom={0}
        onCameraReady={() => {
          setCameraReady(true);
          setStatus(getScanModeHint(scanMode));
        }}
        barcodeScannerSettings={{ barcodeTypes: ALL_BARCODE_TYPES }}
        onBarcodeScanned={processing ? undefined : handleBarcode}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable
            style={styles.iconBtn}
            onPress={() => router.replace("/(tabs)/vehicles")}
            accessibilityLabel="Home"
          >
            <Ionicons name="home-outline" size={22} color="#fff" />
          </Pressable>
          <Pressable
            style={[styles.iconBtn, torchOn && styles.topBtnActive]}
            onPress={() => setTorchOn((on) => !on)}
            accessibilityLabel={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
          >
            <Ionicons name={torchOn ? "flash" : "flash-outline"} size={22} color="#fff" />
          </Pressable>
        </View>
        {scanProgress ? (
          <View style={styles.progressPill}>
            <Ionicons
              name="checkmark-circle"
              size={17}
              color={palette.teal200}
            />
            <Text style={styles.progressText}>
              Today {scanProgress.scanned}/{scanProgress.expected}
            </Text>
          </View>
        ) : null}

        <View style={[styles.modeRow, { top: boundaryStyle.top - 46 }]}>
          <Pressable
            style={[styles.modeBtn, scanMode === "barcode" && styles.modeBtnActive]}
            onPress={() => switchScanMode("barcode")}
          >
            <Text
              style={[styles.modeBtnText, scanMode === "barcode" && styles.modeBtnTextActive]}
            >
              Door barcode
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, scanMode === "qr" && styles.modeBtnActive]}
            onPress={() => switchScanMode("qr")}
          >
            <Text style={[styles.modeBtnText, scanMode === "qr" && styles.modeBtnTextActive]}>
              QR code
            </Text>
          </Pressable>
        </View>

        <View style={[styles.boundary, boundaryStyle]}>
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>
        <Text style={[styles.status, { top: boundaryStyle.top + boundaryStyle.height + 14 }]}>
          {status}
        </Text>

        {processing ? (
          <View style={styles.processing}>
            <ActivityIndicator color="#fff" />
            <Text style={styles.processingText}>Saving scan…</Text>
          </View>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </SafeAreaView>

      <SafeAreaView style={styles.bottomBar} pointerEvents="box-none">
        <Pressable
          style={styles.captureBtn}
          onPress={() => void runBarcodeFromPhoto()}
          disabled={processing || !cameraReady}
        >
          <View style={styles.captureInner} />
        </Pressable>
        <Pressable
          style={styles.manualBtn}
          onPress={() => setManualVinVisible(true)}
          disabled={processing}
          accessibilityLabel="Enter last 6 of VIN"
        >
          <Ionicons name="keypad-outline" size={20} color="#fff" />
          <Text style={styles.manualBtnText}>Enter VIN</Text>
        </Pressable>
        {devBuild ? (
          <Pressable
            style={styles.secondaryIconBtn}
            onPress={() => void runOcrTick()}
            disabled={processing || !cameraReady}
            accessibilityLabel="Scan printed text"
          >
            <Ionicons name="text-outline" size={20} color="#fff" />
          </Pressable>
        ) : null}
        <Pressable
          style={styles.secondaryIconBtn}
          onPress={() => router.push("/scan/history")}
          accessibilityLabel="Scan history"
        >
          <Ionicons name="time-outline" size={20} color="#fff" />
        </Pressable>
      </SafeAreaView>

      <ManualVinModal
        visible={manualVinVisible}
        onClose={() => setManualVinVisible(false)}
        onCheckPriceList={handleManualCheck}
        onSaveScan={handleManualSave}
      />

      <ScanResultModal
        visible={scanModalVisible}
        loading={scanModalLoading}
        result={scanResult}
        error={scanModalError}
        onViewVehicle={handleViewScannedVehicle}
        onScanAnother={dismissScanModal}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.cameraBg },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
    gap: spacing.md,
  },
  iconBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  topBtnActive: { borderColor: palette.teal500, backgroundColor: "rgba(13,148,136,0.45)" },
  progressPill: {
    position: "absolute",
    top: spacing.xl,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: "rgba(15,23,42,0.82)",
    borderWidth: 1,
    borderColor: "rgba(153,246,228,0.35)",
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  progressText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  modeRow: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  modeBtn: {
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  modeBtnActive: {
    borderColor: palette.teal500,
    backgroundColor: "rgba(13,148,136,0.55)",
  },
  modeBtnText: { color: "#e4e4e7", fontWeight: "600", fontSize: 13 },
  modeBtnTextActive: { color: "#fff", fontWeight: "700" },
  boundary: {
    position: "absolute",
    borderWidth: 2,
    borderColor: palette.teal500,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  corner: {
    position: "absolute",
    width: 22,
    height: 22,
    borderColor: palette.teal200,
  },
  cornerTopLeft: {
    left: -1,
    top: -1,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 10,
  },
  cornerTopRight: {
    right: -1,
    top: -1,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 10,
  },
  cornerBottomLeft: {
    left: -1,
    bottom: -1,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 10,
  },
  cornerBottomRight: {
    right: -1,
    bottom: -1,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 10,
  },
  status: {
    position: "absolute",
    left: 16,
    right: 16,
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
    fontSize: 13,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
  },
  captureBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
  },
  secondaryIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  manualBtn: {
    minHeight: 48,
    borderRadius: 24,
    paddingHorizontal: spacing.md,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  manualBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  processing: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
  },
  processingText: { color: "#fff", fontWeight: "600" },
  error: { color: "#fecaca", marginTop: 12, fontWeight: "600" },
  center: {
    flex: 1,
    backgroundColor: colors.cameraBg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  message: { textAlign: "center", color: "#e4e4e7", marginBottom: 16 },
  button: {
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  buttonText: { color: "#fff", fontWeight: "600" },
});
