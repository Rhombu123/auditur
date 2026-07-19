import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { VinSearchInput } from "@/components/vin-search-input";
import { searchAllVehicles } from "@/lib/mobile-api";
import type { VehicleSearchResult } from "@/lib/types";
import { formatVinPrimary, formatVinSecondary } from "@/lib/vin-display";
import {
  formatVehicleTitle,
  getVehicleDisplay,
  visibleVehicleColor,
} from "@/lib/vehicle-display";

export default function SearchScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<VehicleSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setResults(await searchAllVehicles(query));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Search failed.");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 200);
    return () => clearTimeout(timer);
  }, [load]);

  const grouped = useMemo(() => {
    const scanned = results.filter((r) => r.kind === "scanned");
    const inventory = results.filter((r) => r.kind === "inventory");
    return { scanned, inventory };
  }, [results]);

  function openResult(item: VehicleSearchResult) {
    if (item.kind === "scanned") {
      router.push({
        pathname: "/vehicle/[vinSuffix]",
        params: { vinSuffix: item.vinSuffix },
      });
      return;
    }

    router.push("/(tabs)/vehicles");
  }

  function renderResult(item: VehicleSearchResult) {
    const display = getVehicleDisplay({
      model: item.model,
      color: item.color,
      year: null,
    });
    const color = visibleVehicleColor(display.color);
    const vinSecondary = formatVinSecondary(item.vin, item.vinSuffix);

    return (
      <Pressable key={`${item.kind}-${item.vinSuffix}-${item.id}`} style={styles.card} onPress={() => openResult(item)}>
        <View style={styles.cardHeader}>
          <Text style={styles.badge}>
            {item.kind === "scanned" ? "Scanned" : "Inventory PDF"}
          </Text>
          {item.scannedAt ? (
            <Text style={styles.time}>
              {new Date(item.scannedAt).toLocaleDateString()}
            </Text>
          ) : null}
        </View>
        <Text style={styles.vin}>{formatVinPrimary(item.vin, item.vinSuffix)}</Text>
        {vinSecondary ? <Text style={styles.vinMeta}>{vinSecondary}</Text> : null}
        <Text style={styles.model}>{formatVehicleTitle(display)}</Text>
        {color ? <Text style={styles.detail}>{color}</Text> : null}
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        Search by last 6, last 8, or full VIN — across scanned vehicles and your PDF inventory.
      </Text>

      <VinSearchInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Enter VIN (6, 8, or 17 characters)…"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} color="#059669" />
      ) : (
        <FlatList
          data={[
            ...(grouped.scanned.length
              ? [{ type: "header" as const, title: "Scanned on lot" }]
              : []),
            ...grouped.scanned.map((item) => ({ type: "item" as const, item })),
            ...(grouped.inventory.length
              ? [{ type: "header" as const, title: "From inventory PDF" }]
              : []),
            ...grouped.inventory.map((item) => ({ type: "item" as const, item })),
          ]}
          keyExtractor={(row, index) =>
            row.type === "header" ? `header-${row.title}` : `item-${row.item.kind}-${row.item.vinSuffix}-${index}`
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <Text style={styles.empty}>
              {query.trim()
                ? "No vehicles match that VIN."
                : "Type a VIN to search scanned vehicles and inventory."}
            </Text>
          }
          renderItem={({ item: row }) =>
            row.type === "header" ? (
              <Text style={styles.sectionTitle}>{row.title}</Text>
            ) : (
              renderResult(row.item)
            )
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fafafa" },
  subtitle: { color: "#71717a", paddingHorizontal: 16, paddingTop: 12, lineHeight: 20 },
  search: { margin: 16, marginBottom: 8 },
  error: { color: "#dc2626", paddingHorizontal: 16 },
  empty: { textAlign: "center", color: "#71717a", marginTop: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#047857",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#e4e4e7",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  badge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#047857",
    textTransform: "uppercase",
  },
  time: { fontSize: 11, color: "#a1a1aa" },
  vin: {
    fontFamily: "Menlo",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1,
    color: "#18181b",
  },
  vinMeta: { color: "#71717a", fontSize: 11, marginTop: 2 },
  model: { fontWeight: "700", marginTop: 6, fontSize: 16, color: "#18181b" },
  detail: { color: "#52525b", marginTop: 4, fontSize: 13 },
});
