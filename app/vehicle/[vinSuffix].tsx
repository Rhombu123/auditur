import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import MapView, { Marker } from "react-native-maps";

import { VehicleEditorModal } from "@/components/vehicle-editor-modal";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorText, SectionTitle } from "@/components/ui/screen";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import {
  deleteScannedVehicleByVinSuffix,
  fetchScannedVehicles,
  fetchVehicleScanHistory,
  updateScannedVehicle,
} from "@/lib/mobile-api";
import type { ScanRecord, ScannedVehicle } from "@/lib/types";
import { getErrorMessage } from "@/lib/errors";
import { formatVinPrimary, formatVinSecondary } from "@/lib/vin-display";
import { goBackOrHome } from "@/lib/navigation";
import {
  buildVehicleShareText,
  getCopyableVin,
} from "@/lib/vehicle-share";
import { formatVehicleTitle, getVehicleDisplay } from "@/lib/vehicle-display";

function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function ScanEventRow({
  item,
  highlighted,
}: {
  item: ScanRecord;
  highlighted?: boolean;
}) {
  return (
    <View style={[styles.eventCard, highlighted && styles.eventHighlighted]}>
      <Text style={styles.eventTime}>
        {new Date(item.scannedAt).toLocaleString()}
      </Text>
      {item.scannerEmail ? (
        <Text style={styles.eventScanner}>{item.scannerEmail}</Text>
      ) : null}
      <Text style={styles.eventLocation}>
        {formatCoords(item.latitude, item.longitude)}
      </Text>
      {item.accuracy != null ? (
        <Text style={styles.eventMeta}>±{Math.round(item.accuracy)}m accuracy</Text>
      ) : null}
    </View>
  );
}

export default function VehicleDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ vinSuffix: string; highlightId?: string }>();
  const vinSuffix = (params.vinSuffix ?? "").toUpperCase();
  const highlightId = params.highlightId ?? null;

  const [vehicle, setVehicle] = useState<ScannedVehicle | null>(null);
  const [history, setHistory] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [copiedVin, setCopiedVin] = useState(false);

  const load = useCallback(async () => {
    if (!vinSuffix) return;
    setLoading(true);
    setError(null);
    try {
      const [vehicles, scans] = await Promise.all([
        fetchScannedVehicles(),
        fetchVehicleScanHistory(vinSuffix),
      ]);
      setVehicle(vehicles.find((v) => v.vinSuffix === vinSuffix) ?? null);
      setHistory(scans);
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
  const mapRegion = vehicle
    ? {
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        latitudeDelta: 0.004,
        longitudeDelta: 0.004,
      }
    : null;

  const historyMarkers = useMemo(
    () =>
      history.map((scan) => ({
        id: scan.id,
        latitude: scan.latitude,
        longitude: scan.longitude,
        isLatest: scan.id === history[0]?.id,
      })),
    [history],
  );

  async function handleSave(id: string, model: string, color: string) {
    await updateScannedVehicle(id, { model, color });
    await load();
  }

  function confirmDelete() {
    if (!vehicle) return;
    Alert.alert(
      "Delete vehicle",
      `Permanently delete ${formatVinPrimary(vehicle.vin, vehicle.vinSuffix)} and all ${history.length} scan records?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteScannedVehicleByVinSuffix(vehicle.vinSuffix);
                goBackOrHome(router, "/(tabs)/vehicles");
              } catch (deleteError) {
                setError(getErrorMessage(deleteError, "Delete failed."));
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
        message: buildVehicleShareText(vehicle),
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

      {error ? <ErrorText>{error}</ErrorText> : null}

      {vehicle && display ? (
        <View style={styles.summary}>
          <Text style={styles.vin}>
            {formatVinPrimary(vehicle.vin, vehicle.vinSuffix)}
          </Text>
          {formatVinSecondary(vehicle.vin, vehicle.vinSuffix) ? (
            <Text style={styles.vinMeta}>
              {formatVinSecondary(vehicle.vin, vehicle.vinSuffix)}
            </Text>
          ) : null}
          <Text style={styles.model}>{formatVehicleTitle(display)}</Text>
          <Text style={styles.detail}>{display.color}</Text>
          <Text style={styles.scanCount}>
            {history.length} scan{history.length === 1 ? "" : "s"}
          </Text>
          <View style={styles.actions}>
            <Button
              label={copiedVin ? "Copied!" : "Copy VIN"}
              variant="secondary"
              compact
              onPress={() => void handleCopyVin()}
            />
            <Button label="Share" variant="secondary" compact onPress={() => void handleShareVehicle()} />
            <Button label="Edit" variant="secondary" compact onPress={() => setEditing(true)} />
            <Button label="Delete" variant="danger" compact onPress={confirmDelete} />
          </View>
        </View>
      ) : null}

      {mapRegion && vehicle ? (
        <MapView style={styles.map} mapType="satellite" initialRegion={mapRegion}>
          {historyMarkers.map((marker) => (
            <Marker
              key={marker.id}
              coordinate={{
                latitude: marker.latitude,
                longitude: marker.longitude,
              }}
              pinColor={marker.isLatest ? colors.mapPin : colors.mapPinHistory}
              title={marker.isLatest ? "Latest scan" : "Previous scan"}
            />
          ))}
        </MapView>
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
            highlighted={item.id === highlightId}
          />
        )}
      />

      {vehicle ? (
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
    fontWeight: "800",
    color: colors.text,
  },
  vinMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  model: { fontSize: 18, fontWeight: "700", marginTop: spacing.sm, color: colors.text },
  detail: { color: colors.textSecondary, marginTop: spacing.xs },
  scanCount: { color: colors.primaryDark, fontWeight: "600", marginTop: spacing.sm, fontSize: 13 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
  map: { height: 180, width: "100%" },
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
    ...typography.vin,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  eventMeta: { color: colors.textMuted, fontSize: 12, marginTop: spacing.xs },
  error: { color: colors.danger, padding: spacing.lg },
});
