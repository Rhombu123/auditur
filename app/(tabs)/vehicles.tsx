import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorText, Screen } from "@/components/ui/screen";
import { StatCard, StatRow } from "@/components/ui/stat-card";
import { VehicleEditorModal } from "@/components/vehicle-editor-modal";
import { VinSearchInput } from "@/components/vin-search-input";
import { colors, spacing, typography } from "@/constants/theme";
import { getErrorMessage } from "@/lib/errors";
import {
  MOBILE_CACHE_KEYS,
  readMobileCache,
  writeMobileCache,
} from "@/lib/mobile-cache";
import {
  deleteScannedVehicleByVinSuffix,
  fetchScannedVehicles,
  updateScannedVehicle,
} from "@/lib/mobile-api";
import type { ScannedVehicle } from "@/lib/types";
import { formatVinPrimary, formatVinSecondary } from "@/lib/vin-display";
import { matchesVehicleSearch } from "@/lib/vin-search";
import { formatVehicleTitle, getVehicleDisplay } from "@/lib/vehicle-display";

export default function VehiclesScreen() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<ScannedVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ScannedVehicle | null>(null);

  const load = useCallback(async () => {
    const cached = await readMobileCache<ScannedVehicle[]>(MOBILE_CACHE_KEYS.vehicles);
    if (cached) {
      setVehicles(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const fresh = await fetchScannedVehicles();
      setVehicles(fresh);
      await writeMobileCache(MOBILE_CACHE_KEYS.vehicles, fresh);
    } catch (loadError) {
      if (!cached) {
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
    return vehicles.filter((v) =>
      matchesVehicleSearch(search, {
        vin: v.vin,
        vinSuffix: v.vinSuffix,
        model: v.model,
        color: v.color,
      }),
    );
  }, [search, vehicles]);

  const matchedCount = useMemo(
    () => vehicles.filter((v) => v.matched).length,
    [vehicles],
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

  function confirmDelete(vehicle: ScannedVehicle) {
    Alert.alert(
      "Delete vehicle",
      `Permanently delete ${formatVinPrimary(vehicle.vin, vehicle.vinSuffix)} and all scan records?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteScannedVehicleByVinSuffix(vehicle.vinSuffix);
                setVehicles((current) => {
                  const next = current.filter((v) => v.id !== vehicle.id);
                  void writeMobileCache(MOBILE_CACHE_KEYS.vehicles, next);
                  return next;
                });
              } catch (deleteError) {
                setError(getErrorMessage(deleteError, "Delete failed."));
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

      <StatRow>
        <StatCard label="Scanned" value={vehicles.length} accent />
        <StatCard label="On price list" value={matchedCount} />
        <StatCard label="Manual" value={vehicles.length - matchedCount} />
      </StatRow>

      <VinSearchInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
      />

      {error ? <ErrorText>{error}</ErrorText> : null}

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.vinSuffix}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState>No vehicles yet. Use the Scan tab to add one.</EmptyState>
          }
          renderItem={({ item }) => {
            const display = getVehicleDisplay(item);
            const vinSecondary = formatVinSecondary(item.vin, item.vinSuffix);
            return (
              <Card onPress={() => openVehicle(item.vinSuffix)}>
                <Text style={styles.vin} numberOfLines={1}>
                  {formatVinPrimary(item.vin, item.vinSuffix)}
                </Text>
                {vinSecondary ? (
                  <Text style={styles.vinMeta}>{vinSecondary}</Text>
                ) : null}
                <Text style={styles.vehicle} numberOfLines={2} ellipsizeMode="tail">
                  {formatVehicleTitle(display)}
                </Text>
                <Text style={styles.detail} numberOfLines={1} ellipsizeMode="tail">
                  {display.color}
                  {item.matched ? " · In inventory" : " · Manual scan"}
                  {" · "}
                  {item.scanCount} scan{item.scanCount === 1 ? "" : "s"}
                </Text>
                <View style={styles.actions}>
                  <Button
                    label="Edit"
                    variant="secondary"
                    compact
                    onPress={() => setEditing(item)}
                  />
                  <Button
                    label="Delete"
                    variant="danger"
                    compact
                    onPress={() => confirmDelete(item)}
                  />
                </View>
              </Card>
            );
          }}
        />
      )}

      <VehicleEditorModal
        vehicle={editing}
        visible={Boolean(editing)}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
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
  loader: { marginTop: spacing.xxl },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
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
  actions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.md },
});
