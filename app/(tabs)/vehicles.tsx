import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { SkeletonCards } from "@/components/ui/skeleton-card";
import { EmptyState, ErrorText, Screen } from "@/components/ui/screen";
import { VehicleEditorModal } from "@/components/vehicle-editor-modal";
import { VinSearchInput } from "@/components/vin-search-input";
import { LotStatusBadge } from "@/components/lot-status-badge";
import { colors, spacing, typography } from "@/constants/theme";
import { useDealership } from "@/lib/dealership-context";
import { getErrorMessage } from "@/lib/errors";
import {
  MOBILE_CACHE_KEYS,
  readMobileCache,
  writeMobileCache,
} from "@/lib/mobile-cache";
import {
  deleteScannedVehicle,
  fetchLotZones,
  fetchScannedVehicles,
  markVehicleRemoved,
  restoreVehicle,
  updateScannedVehicle,
} from "@/lib/mobile-api";
import type { LotZone, ScannedVehicle } from "@/lib/types";
import { findZoneForPoint } from "@/lib/geo";
import { formatVinPrimary, formatVinSecondary } from "@/lib/vin-display";
import { matchesVehicleSearch } from "@/lib/vin-search";
import {
  formatVehicleTitle,
  getVehicleDisplay,
  visibleVehicleColor,
} from "@/lib/vehicle-display";

function vehicleAccent(vehicle: ScannedVehicle): string {
  if (vehicle.lotStatus === "removed") return colors.danger;
  if (vehicle.lotStatus === "sold" || vehicle.lotStatus === "auctioned") {
    return colors.warning;
  }
  return vehicle.matched ? colors.primary : colors.accent;
}

export default function VehiclesScreen() {
  const router = useRouter();
  const { activeDealership, hasPermission } = useDealership();
  const canManageVehicles = hasPermission("manage_vehicles");
  const canRemoveVehicles = Boolean(activeDealership);
  const [vehicles, setVehicles] = useState<ScannedVehicle[]>([]);
  const [zones, setZones] = useState<LotZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [zoneFilterId, setZoneFilterId] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScannedVehicle | null>(null);

  const load = useCallback(async () => {
    const [cachedVehicles, cachedZones] = await Promise.all([
      readMobileCache<ScannedVehicle[]>(MOBILE_CACHE_KEYS.vehicles),
      readMobileCache<LotZone[]>(MOBILE_CACHE_KEYS.zones),
    ]);
    if (cachedVehicles) {
      setVehicles(cachedVehicles);
      setLoading(false);
    } else {
      setLoading(true);
    }
    if (cachedZones) setZones(cachedZones);
    setError(null);
    try {
      const [freshVehicles, freshZones] = await Promise.all([
        fetchScannedVehicles(),
        fetchLotZones(),
      ]);
      setVehicles(freshVehicles);
      setZones(freshZones);
      await Promise.all([
        writeMobileCache(MOBILE_CACHE_KEYS.vehicles, freshVehicles),
        writeMobileCache(MOBILE_CACHE_KEYS.zones, freshZones),
      ]);
    } catch (loadError) {
      if (!cachedVehicles) {
        setError(getErrorMessage(loadError, "Failed to load vehicles."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return vehicles.filter((vehicle) => {
      const matchesSection =
        !zoneFilterId ||
        findZoneForPoint(
          { latitude: vehicle.latitude, longitude: vehicle.longitude },
          zones,
        ) === zoneFilterId;
      return (
        matchesSection &&
        matchesVehicleSearch(search, {
          vin: vehicle.vin,
          vinSuffix: vehicle.vinSuffix,
          model: vehicle.model,
          color: vehicle.color,
        })
      );
    });
  }, [search, vehicles, zoneFilterId, zones]);

  const zoneById = useMemo(
    () => new Map(zones.map((zone) => [zone.id, zone])),
    [zones],
  );

  function openVehicle(vinSuffix: string) {
    router.push({
      pathname: "/vehicle/[vinSuffix]",
      params: { vinSuffix },
    });
  }

  async function handleSave(id: string, model: string, color: string) {
    await updateScannedVehicle(id, { model, color });
    setVehicles((current) => {
      const next = current.map((v) => (v.id === id ? { ...v, model, color } : v));
      void writeMobileCache(MOBILE_CACHE_KEYS.vehicles, next);
      return next;
    });
  }

  function confirmRemove(vehicle: ScannedVehicle) {
    if (!vehicle.inventoryItemId) {
      Alert.alert(
        "Delete vehicle?",
        `${formatVinPrimary(vehicle.vin, vehicle.vinSuffix)} and its ${vehicle.scanCount} scan${vehicle.scanCount === 1 ? "" : "s"} will be removed from active views. The deletion remains in the audit log.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => {
              void (async () => {
                try {
                  await deleteScannedVehicle(vehicle.id);
                  await load();
                } catch (deleteError) {
                  setError(getErrorMessage(deleteError, "Delete failed."));
                }
              })();
            },
          },
        ],
      );
      return;
    }
    const restoring = vehicle.lotStatus === "removed";
    Alert.alert(
      restoring ? "Restore vehicle" : "Delete vehicle from active inventory?",
      restoring
        ? `Return ${formatVinPrimary(vehicle.vin, vehicle.vinSuffix)} to active inventory? Its previous scan logs will remain attached.`
        : `${formatVinPrimary(vehicle.vin, vehicle.vinSuffix)} will disappear from active inventory. Its scan history stays in the audit log so mistakes remain traceable.`,
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
                } else {
                  await markVehicleRemoved(vehicle.inventoryItemId!);
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

  return (
    <Screen>
      <View style={styles.topBar}>
        <Text style={styles.subtitle}>
          All scanned vehicles on the lot. Use Audit for today&apos;s completion status.
        </Text>
      </View>

      {zones.length > 0 ? (
        <ScrollView
          style={styles.sectionScroller}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <Chip
            label="All sections"
            selected={!zoneFilterId}
            onPress={() => setZoneFilterId(null)}
          />
          {zones.map((zone) => (
            <Chip
              key={zone.id}
              label={zone.name}
              selected={zoneFilterId === zone.id}
              accentColor={zone.strokeColor}
              onPress={() => setZoneFilterId(zone.id)}
            />
          ))}
        </ScrollView>
      ) : (
        <Text style={styles.sectionHint}>
          Create sections on the Map to filter this list.
        </Text>
      )}

      <VinSearchInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}

      {loading ? (
        <SkeletonCards />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.vinSuffix}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState>
              {vehicles.length === 0
                ? "No vehicles yet. Use the Scan tab to add one."
                : "No vehicles match this filter."}
            </EmptyState>
          }
          renderItem={({ item }) => {
            const display = getVehicleDisplay(item);
            const color = visibleVehicleColor(display.color);
            const vinSecondary = formatVinSecondary(item.vin, item.vinSuffix);
            const zoneId = findZoneForPoint(
              { latitude: item.latitude, longitude: item.longitude },
              zones,
            );
            const zoneName = zoneId ? zoneById.get(zoneId)?.name : null;
            return (
              <Card
                style={{
                  ...styles.vehicleCard,
                  borderLeftColor: vehicleAccent(item),
                }}
                onPress={() => openVehicle(item.vinSuffix)}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.vin} numberOfLines={1}>
                    {formatVinPrimary(item.vin, item.vinSuffix)}
                  </Text>
                  <LotStatusBadge status={item.lotStatus} />
                </View>
                {vinSecondary ? (
                  <Text style={styles.vinMeta}>{vinSecondary}</Text>
                ) : null}
                <Text style={styles.vehicle} numberOfLines={2} ellipsizeMode="tail">
                  {formatVehicleTitle(display)}
                </Text>
                <Text style={styles.detail} numberOfLines={1} ellipsizeMode="tail">
                  {color ? `${color} · ` : ""}
                  {item.matched ? "In inventory" : "Manual scan"}
                  {zoneName ? ` · ${zoneName}` : ""}
                  {" · "}
                  {item.scanCount} scan{item.scanCount === 1 ? "" : "s"}
                </Text>
                {canManageVehicles || canRemoveVehicles ? (
                  <View style={styles.actions}>
                    {canManageVehicles ? (
                      <Button
                        label="Edit"
                        variant="secondary"
                        compact
                        onPress={() => setEditing(item)}
                      />
                    ) : null}
                    {canRemoveVehicles &&
                    (!item.inventoryItemId ||
                      item.lotStatus === "active" ||
                      item.lotStatus === "removed") ? (
                      <Button
                        label={
                          item.inventoryItemId && item.lotStatus === "removed"
                            ? "Restore"
                            : "Delete vehicle"
                        }
                        variant={item.lotStatus === "removed" ? "secondary" : "danger"}
                        compact
                        onPress={() => confirmRemove(item)}
                      />
                    ) : null}
                  </View>
                ) : null}
              </Card>
            );
          }}
        />
      )}

      {canManageVehicles ? (
        <VehicleEditorModal
          vehicle={editing}
          visible={Boolean(editing)}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    alignItems: "flex-start",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  subtitle: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  search: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  filters: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
    alignItems: "center",
  },
  sectionScroller: {
    flexGrow: 0,
    height: 56,
  },
  sectionHint: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "600",
  },
  loader: { marginTop: spacing.xxl },
  list: { padding: spacing.lg, paddingBottom: 132 },
  vehicleCard: {
    borderLeftWidth: 4,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  vin: {
    ...typography.vin,
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  vinMeta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  vehicle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: spacing.sm,
    color: colors.text,
    lineHeight: 22,
  },
  detail: { color: colors.textSecondary, marginTop: spacing.xs, fontSize: 13 },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
