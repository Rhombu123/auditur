import * as DocumentPicker from "expo-document-picker";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorText, Screen, ScreenSubtitle } from "@/components/ui/screen";
import { VinSearchInput } from "@/components/vin-search-input";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import { fetchInventory, uploadInventoryPdf } from "@/lib/mobile-api";
import type { InventoryItem } from "@/lib/types";
import { matchesVehicleSearch } from "@/lib/vin-search";

export default function UploadScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    try {
      const inventory = await fetchInventory();
      if (inventory) {
        setFileName(inventory.fileName);
        setItems(inventory.items);
      }
    } catch {
      // No inventory yet.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const filteredItems = useMemo(() => {
    return items.filter((item) =>
      matchesVehicleSearch(search, {
        vin: null,
        vinSuffix: item.vinSuffix,
        model: item.model,
        color: item.color,
      }),
    );
  }, [items, search]);

  async function pickPdf() {
    setError(null);
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploading(true);

    try {
      const inventory = await uploadInventoryPdf(asset.uri, asset.name);
      setFileName(inventory.fileName);
      setItems(inventory.items);
      setSearch("");
    } catch (uploadError) {
      setError(
        uploadError instanceof Error ? uploadError.message : "Upload failed.",
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <Screen style={styles.container}>
      <ScreenSubtitle>
        Upload your dealership price list PDF. We extract VIN6, model, color, and
        days on lot.
      </ScreenSubtitle>

      <Pressable
        style={[styles.uploadCard, uploading && styles.uploadCardDisabled]}
        onPress={() => void pickPdf()}
        disabled={uploading}
      >
        <View style={styles.uploadIcon}>
          {uploading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Ionicons name="document-text-outline" size={28} color={colors.primary} />
          )}
        </View>
        <View style={styles.uploadCopy}>
          <Text style={styles.uploadTitle}>
            {uploading ? "Processing PDF…" : "Choose price list PDF"}
          </Text>
          <Text style={styles.uploadHint}>
            Tap to select a file from your device
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {fileName ? (
        <View style={styles.metaRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={styles.meta}>
            {fileName} · {items.length} vehicles loaded
          </Text>
        </View>
      ) : null}

      <VinSearchInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <ActivityIndicator style={styles.loader} color={colors.primary} />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.vinSuffix}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState>No vehicles loaded yet.</EmptyState>
          }
          renderItem={({ item }) => (
            <Card>
              <Text style={styles.vin}>{item.vinSuffix}</Text>
              <Text style={styles.model}>{item.model}</Text>
              <Text style={styles.detail}>
                {item.color} · {item.daysOnLot ?? "—"} days on lot
              </Text>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: 0 },
  uploadCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  uploadCardDisabled: { opacity: 0.75 },
  uploadIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  uploadCopy: { flex: 1 },
  uploadTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  uploadHint: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  meta: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  search: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  loader: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxxl },
  vin: {
    ...typography.vin,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  model: { fontWeight: "600", marginTop: spacing.xs, color: colors.text, fontSize: 15 },
  detail: { color: colors.textSecondary, marginTop: 2, fontSize: 13 },
});
