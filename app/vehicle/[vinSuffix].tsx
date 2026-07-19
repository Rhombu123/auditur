import { AnimatePresence, MotiView } from "moti";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Location from "expo-location";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import MapView, { Marker, type Region } from "react-native-maps";

import { VehicleEditorModal } from "@/components/vehicle-editor-modal";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, SectionTitle } from "@/components/ui/screen";
import { LotStatusBadge } from "@/components/lot-status-badge";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { useDealership } from "@/lib/dealership-context";
import {
  deleteScannedVehicle,
  fetchLotZones,
  fetchScannedVehicles,
  fetchVehicleScanHistory,
  markVehicleRemoved,
  restoreVehicle,
  updateScannedVehicle,
} from "@/lib/mobile-api";
import type { LotZone, ScanRecord, ScannedVehicle } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";
import { findZoneForPoint } from "@/lib/geo";
import { formatVinPrimary } from "@/lib/vin-display";
import { goBackOrHome } from "@/lib/navigation";
import {
  buildVehicleShareText,
  getCopyableVin,
} from "@/lib/vehicle-share";
import {
  formatVehicleTitle,
  getVehicleDisplay,
  visibleVehicleColor,
} from "@/lib/vehicle-display";

function formatNearbyLocation(address: Location.LocationGeocodedAddress): string | null {
  const name = address.name?.trim();
  if (name && !/^\d+$/.test(name)) return name;

  const street = address.street?.trim();
  const locality = (address.city ?? address.district ?? address.subregion)?.trim();
  const parts = [street, locality].filter(
    (value, index, values): value is string =>
      Boolean(value) && values.indexOf(value) === index,
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

function formatScanTimestamp(value: string): string {
  const date = new Date(value);
  const day = date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "2-digit",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${day} · ${time}`;
}

function ScanEventRow({
  item,
  highlighted,
  locationName,
  onPress,
}: {
  item: ScanRecord;
  highlighted?: boolean;
  locationName: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.eventCard, highlighted && styles.eventHighlighted]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Show ${locationName} on the map`}
    >
      <Text style={styles.eventTime}>
        {formatScanTimestamp(item.scannedAt)}
      </Text>
      {item.scannerEmail ? (
        <Text style={styles.eventScanner}>{item.scannerEmail}</Text>
      ) : null}
      <Text style={styles.eventLocation}>{locationName}</Text>
      {item.accuracy != null ? (
        <Text style={styles.eventMeta}>±{Math.round(item.accuracy)}m accuracy</Text>
      ) : null}
      <Text style={styles.eventAction}>
        {highlighted ? "Showing on map" : "Tap to view this scan location"}
      </Text>
    </Pressable>
  );
}

export default function VehicleDetailScreen() {
  const { activeDealership, hasPermission } = useDealership();
  const canManageVehicles = hasPermission("manage_vehicles");
  const canRemoveVehicles = Boolean(activeDealership);
  const router = useRouter();
  const params = useLocalSearchParams<{ vinSuffix: string; highlightId?: string }>();
  const vinSuffix = (params.vinSuffix ?? "").toUpperCase();
  const highlightId = params.highlightId ?? null;

  const [vehicle, setVehicle] = useState<ScannedVehicle | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [zones, setZones] = useState<LotZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copiedVin, setCopiedVin] = useState(false);
  const [selectedScanId, setSelectedScanId] = useState<string | null>(
    highlightId,
  );
  const [nearbyLocations, setNearbyLocations] = useState<Record<string, string>>(
    {},
  );
  const nearbyLocationsRef = useRef<Record<string, string>>({});
  const mapRef = useRef<MapView | null>(null);

  const load = useCallback(async () => {
    if (!vinSuffix) return;
    setLoading(true);
    setError(null);
    try {
      const [vehicles, scans, lotZones] = await Promise.all([
        fetchScannedVehicles(),
        fetchVehicleScanHistory(vinSuffix),
        fetchLotZones(),
      ]);
      setVehicle(vehicles.find((v) => v.vinSuffix === vinSuffix) ?? null);
      setHistory(scans);
      setZones(lotZones);
      setSelectedScanId((current) => current ?? scans[0]?.id ?? null);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Failed to load vehicle."));
    } finally {
      setLoading(false);
    }
  }, [vinSuffix]);

  useEffect(() => {
    void load();
  }, [load]);

  const display = vehicle ? getVehicleDisplay(vehicle) : null;
  const displayColor = display ? visibleVehicleColor(display.color) : null;
  const mapRegion = vehicle
    ? {
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }
    : null;

  const scanSections = useMemo(() => {
    const names: Record<string, string> = {};
    for (const scan of history) {
      const zoneId = findZoneForPoint(
        { latitude: scan.latitude, longitude: scan.longitude },
        zones,
      );
      const zoneName = zones.find((zone) => zone.id === zoneId)?.name;
      if (zoneName) names[scan.id] = zoneName;
    }
    return names;
  }, [history, zones]);

  useEffect(() => {
    let cancelled = false;

    async function resolveNearbyLocations() {
      for (const scan of history) {
        if (
          cancelled ||
          scanSections[scan.id] ||
          nearbyLocationsRef.current[scan.id]
        ) {
          continue;
        }

        let label = "Saved scan location";
        try {
          const [address] = await Location.reverseGeocodeAsync({
            latitude: scan.latitude,
            longitude: scan.longitude,
          });
          label = (address && formatNearbyLocation(address)) || label;
        } catch {
          // The map remains usable if reverse geocoding is unavailable.
        }

        if (cancelled) return;
        nearbyLocationsRef.current[scan.id] = label;
        setNearbyLocations((current) => ({ ...current, [scan.id]: label }));
      }
    }

    void resolveNearbyLocations();
    return () => {
      cancelled = true;
    };
  }, [history, scanSections]);

  const scanLocationNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const scan of history) {
      names[scan.id] =
        scanSections[scan.id] ??
        nearbyLocations[scan.id] ??
        "Finding nearby location…";
    }
    return names;
  }, [history, nearbyLocations, scanSections]);

  const historyMarkers = useMemo(
    () =>
      history.map((scan) => ({
        ...scan,
        isLatest: scan.id === history[0]?.id,
        isSelected: scan.id === selectedScanId,
        locationName: scanLocationNames[scan.id] ?? "Saved scan location",
      })),
    [history, scanLocationNames, selectedScanId],
  );

  const sectionName = useMemo(() => {
    if (!vehicle) return null;
    const zoneId = findZoneForPoint(
      { latitude: vehicle.latitude, longitude: vehicle.longitude },
      zones,
    );
    return zones.find((zone) => zone.id === zoneId)?.name ?? null;
  }, [vehicle, zones]);

  const focusScanOnMap = useCallback((scan: ScanRecord) => {
    setSelectedScanId(scan.id);
    const region: Region = {
      latitude: scan.latitude,
      longitude: scan.longitude,
      latitudeDelta: 0.0012,
      longitudeDelta: 0.0012,
    };
    mapRef.current?.animateToRegion(region, 450);
  }, []);

  async function handleSave(id: string, model: string, color: string) {
    await updateScannedVehicle(id, { model, color });
    await load();
  }

  function confirmRemove() {
    if (!vehicle) return;
    const restoring =
      Boolean(vehicle.inventoryItemId) && vehicle.lotStatus === "removed";
    Alert.alert(
      restoring ? "Restore vehicle" : "Delete vehicle from active inventory?",
      restoring
        ? `Return ${formatVinPrimary(vehicle.vin, vehicle.vinSuffix)} to active inventory? Its ${history.length} scan logs will remain attached.`
        : vehicle.inventoryItemId
          ? `${formatVinPrimary(vehicle.vin, vehicle.vinSuffix)} will disappear from active inventory. Its ${history.length} scan logs remain in the audit trail.`
          : `${formatVinPrimary(vehicle.vin, vehicle.vinSuffix)} will be removed from the vehicle list. Its scan records remain in the audit trail.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: restoring ? "Restore" : "Delete",
          style: restoring ? "default" : "destructive",
          onPress: () => {
            void (async () => {
              try {
                if (restoring) {
                  await restoreVehicle(vehicle.inventoryItemId!);
                } else if (vehicle.inventoryItemId) {
                  await markVehicleRemoved(vehicle.inventoryItemId);
                } else {
                  await deleteScannedVehicle(vehicle.id);
                  goBackOrHome(router);
                  return;
                }
                await load();
              } catch (removeError) {
                setError(
                  getErrorMessage(
                    removeError,
                    restoring ? "Restore failed." : "Remove failed.",
                  ),
                );
              }
            })();
          },
        },
      ],
    );
  }

  async function handleCopyVin() {
    if (!vehicle) return;
    await Clipboard.setStringAsync(getCopyableVin(vehicle));
    setCopiedVin(true);
    setTimeout(() => setCopiedVin(false), 2000);
  }

  async function handleShareVehicle() {
    if (!vehicle) return;
    try {
      await Share.share({
        message: buildVehicleShareText(vehicle, sectionName),
        title: formatVehicleTitle(getVehicleDisplay(vehicle)),
      });
    } catch (shareError) {
      if (shareError instanceof Error && shareError.message.includes("cancel")) {
        return;
      }
      setError(getErrorMessage(shareError, "Share failed."));
    }
  }

  if (!vinSuffix) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.error}>No vehicle specified.</Text>
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={colors.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => goBackOrHome(router)}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Vehicle history</Text>
        <View style={{ width: 48 }} />
      </View>

      <AnimatePresence>
        {copiedVin ? (
          <MotiView
            from={{ opacity: 0, translateY: -12, scale: 0.96 }}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            exit={{ opacity: 0, translateY: -8, scale: 0.98 }}
            transition={{ type: "timing", duration: 180 }}
            style={styles.copyToast}
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.copyToastText}>VIN Copied</Text>
          </MotiView>
        ) : null}
      </AnimatePresence>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {mapRegion && vehicle ? (
        <View style={styles.mapWrap}>
          <MapView
            ref={mapRef}
            style={styles.map}
            mapType="hybrid"
            initialRegion={mapRegion}
          >
            {historyMarkers.map((marker) => (
              <Marker
                key={marker.id}
                coordinate={{
                  latitude: marker.latitude,
                  longitude: marker.longitude,
                }}
                pinColor={
                  marker.isSelected
                    ? colors.warning
                    : marker.isLatest
                      ? colors.mapPin
                      : colors.mapPinHistory
                }
                title={marker.locationName}
                description={formatScanTimestamp(marker.scannedAt)}
                onPress={() => focusScanOnMap(marker)}
              />
            ))}
          </MapView>
          {selectedScanId ? (
            <View style={styles.mapLocationPill} pointerEvents="none">
              <Text style={styles.mapLocationLabel} numberOfLines={1}>
                {scanLocationNames[selectedScanId] ?? "Saved scan location"}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {vehicle && display ? (
        <View style={styles.summary}>
          <Pressable
            style={styles.vinButton}
            onPress={() => void handleCopyVin()}
            accessibilityLabel="Copy VIN"
          >
            <Text style={styles.vin}>
              {getCopyableVin(vehicle).slice(0, -8)}
              <Text style={styles.vinEmphasis}>
                {getCopyableVin(vehicle).slice(-8)}
              </Text>
            </Text>
          </Pressable>
          <Text style={styles.model}>{formatVehicleTitle(display)}</Text>
          {displayColor ? <Text style={styles.detail}>{displayColor}</Text> : null}
          <Text style={styles.scanCount}>
            {history.length} scan{history.length === 1 ? "" : "s"}
          </Text>
          <View style={styles.statusBadge}>
            <LotStatusBadge status={vehicle.lotStatus} />
          </View>
          <View style={styles.actions}>
            <Button label="Share" variant="secondary" compact onPress={() => void handleShareVehicle()} />
            {canManageVehicles ? (
              <Button label="Edit" variant="secondary" compact onPress={() => setEditing(true)} />
            ) : null}
            {canRemoveVehicles &&
            (vehicle.lotStatus === "active" || vehicle.lotStatus === "removed") ? (
              <Button
                label={vehicle.lotStatus === "removed" ? "Restore" : "Delete vehicle"}
                variant={vehicle.lotStatus === "removed" ? "secondary" : "danger"}
                compact
                onPress={confirmRemove}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <SectionTitle>Scan log</SectionTitle>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState>No scan history for this vehicle.</EmptyState>
        }
        renderItem={({ item }) => (
          <ScanEventRow
            item={item}
            highlighted={item.id === selectedScanId}
            locationName={scanLocationNames[item.id] ?? "Saved scan location"}
            onPress={() => focusScanOnMap(item)}
          />
        )}
      />

      {vehicle && canManageVehicles ? (
        <VehicleEditorModal
          vehicle={vehicle}
          visible={editing}
          onClose={() => setEditing(false)}
          onSave={handleSave}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { color: colors.primary, fontWeight: "700", fontSize: 16 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  copyToast: {
    position: "absolute",
    top: 60,
    left: 96,
    right: 96,
    minHeight: 34,
    zIndex: 50,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.tabBar,
    shadowColor: colors.tabBar,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  copyToastText: {
    color: colors.onPrimary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  summary: {
    margin: spacing.lg,
    marginBottom: spacing.sm,
    backgroundColor: colors.surfaceActive,
    borderColor: colors.primary,
    borderWidth: 2,
    borderRadius: radius.lg,
    padding: spacing.md + 2,
    ...shadow.card,
  },
  vin: {
    ...typography.vin,
    fontSize: 16,
    fontWeight: "500",
    color: colors.text,
  },
  vinEmphasis: { fontWeight: "900", color: colors.primaryDark },
  vinButton: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  model: { fontSize: 18, fontWeight: "700", marginTop: spacing.sm, color: colors.text },
  detail: { color: colors.textSecondary, marginTop: spacing.xs },
  scanCount: { color: colors.primaryDark, fontWeight: "600", marginTop: spacing.sm, fontSize: 13 },
  statusBadge: { marginTop: spacing.sm },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  mapWrap: { position: "relative" },
  map: { height: 240, width: "100%" },
  mapLocationPill: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
    minHeight: 38,
    justifyContent: "center",
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    ...shadow.card,
  },
  mapLocationLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  eventCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md + 2,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  eventHighlighted: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primaryLight,
  },
  eventTime: { fontWeight: "700", color: colors.text, fontSize: 15 },
  eventScanner: {
    color: colors.primaryDark,
    fontWeight: "600",
    fontSize: 13,
    marginTop: spacing.xs,
  },
  eventLocation: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.sm,
  },
  eventMeta: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  eventAction: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    marginTop: spacing.sm,
  },
  error: { color: colors.danger, padding: spacing.lg },
});
