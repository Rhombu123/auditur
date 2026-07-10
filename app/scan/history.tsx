import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { VinSearchInput } from "@/components/vin-search-input";
import { fetchScannedVehicles } from "@/lib/mobile-api";
import type { ScannedVehicle } from "@/lib/types";
import { formatVinPrimary, formatVinSecondary } from "@/lib/vin-display";
import { matchesVehicleSearch } from "@/lib/vin-search";
import { formatVehicleTitle, getVehicleDisplay } from "@/lib/vehicle-display";

function VehicleRow({ item, onPress }: { item: ScannedVehicle; onPress: () => void }) {
  const display = getVehicleDisplay(item);
  const vinSecondary = formatVinSecondary(item.vin, item.vinSuffix);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.vin}>{formatVinPrimary(item.vin, item.vinSuffix)}</Text>
      {vinSecondary ? <Text style={styles.vinMeta}>{vinSecondary}</Text> : null}
      <Text style={styles.model}>{formatVehicleTitle(display)}</Text>
      <Text style={styles.detail}>
        {display.color} · {item.scanCount} scan{item.scanCount === 1 ? "" : "s"}
      </Text>
      <Text style={styles.meta}>
        Latest: {new Date(item.scannedAt).toLocaleString()}
      </Text>
    </Pressable>
  );
}

export default function ScanHistoryScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState<ScannedVehicle[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVehicles(await fetchScannedVehicles());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load scans.");
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

  function openVehicle(vinSuffix: string) {
    router.push({
      pathname: "/vehicle/[vinSuffix]",
      params: { vinSuffix },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Scan history</Text>
          <Text style={styles.subtitle}>
            {vehicles.length} vehicles · tap for scan log
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.secondaryBtn} onPress={() => router.replace("/(tabs)")}>
            <Text style={styles.secondaryText}>Home</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={() => router.replace("/scan/camera")}>
            <Text style={styles.primaryText}>Scan again</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <VinSearchInput value={search} onChangeText={setSearch} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#059669" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.vinSuffix}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={<Text style={styles.empty}>No scanned vehicles yet.</Text>}
          renderItem={({ item }) => (
            <VehicleRow item={item} onPress={() => openVehicle(item.vinSuffix)} />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e4e4e7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerText: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: "row", gap: 8, alignItems: "center", flexShrink: 0 },
  title: { fontSize: 18, fontWeight: "700", color: "#18181b" },
  subtitle: { marginTop: 2, color: "#71717a" },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  secondaryBtn: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
    backgroundColor: "#fff",
  },
  secondaryText: { color: "#3f3f46", fontWeight: "700", fontSize: 13 },
  primaryBtn: {
    backgroundColor: "#18181b",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  error: { color: "#dc2626", paddingHorizontal: 16, paddingTop: 10 },
  empty: { textAlign: "center", color: "#71717a", marginTop: 24 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  vin: {
    fontFamily: "Menlo",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#18181b",
  },
  vinMeta: { color: "#71717a", fontSize: 11, marginTop: 2 },
  model: { fontSize: 16, fontWeight: "700", marginTop: 8, color: "#18181b" },
  detail: { color: "#52525b", marginTop: 4, fontSize: 13 },
  meta: { color: "#a1a1aa", marginTop: 8, fontSize: 12 },
});
