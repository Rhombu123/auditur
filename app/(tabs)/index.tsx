import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorText, Screen, ScreenSubtitle } from "@/components/ui/screen";
import { SkeletonCards } from "@/components/ui/skeleton-card";
import { VinSearchInput } from "@/components/vin-search-input";
import { colors, radius, shadow, spacing, typography } from "@/constants/theme";
import {
  clearMobileCache,
  MOBILE_CACHE_KEYS,
  readMobileCache,
  writeMobileCache,
} from "@/lib/mobile-cache";
import {
  archiveInventoryUpload,
  fetchInventory,
  uploadInventoryFile,
} from "@/lib/mobile-api";
import type {
  ImportFileFormat,
  InventoryItem,
  InventorySnapshot,
} from "@/lib/types";
import { matchesVehicleSearch } from "@/lib/vin-search";

function visibleUploadError(error: unknown, fallback: string): string | null {
  const message = error instanceof Error ? error.message : fallback;
  return message === "Lot data is unavailable right now." ? null : message;
}

function formatSource(sourceSystem: string | undefined): string {
  if (!sourceSystem || sourceSystem === "unknown") return "Unknown source";
  return sourceSystem
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function UploadScreen() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileFormat, setFileFormat] = useState<ImportFileFormat | null>(null);
  const [sourceSystem, setSourceSystem] = useState<string | undefined>();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadInventory = useCallback(async () => {
    const cachedInventory =
      await readMobileCache<InventorySnapshot | null>(MOBILE_CACHE_KEYS.inventory);
    if (cachedInventory !== null) {
      setActiveUploadId(cachedInventory?.id ?? null);
      setFileName(cachedInventory?.fileName ?? null);
      setFileFormat(cachedInventory?.fileFormat ?? null);
      setSourceSystem(cachedInventory?.sourceSystem);
      setWarnings(cachedInventory?.warnings ?? []);
      setItems(cachedInventory?.items ?? []);
    }
    setLoading(cachedInventory === null);
    setError(null);
    try {
      const inventory = await fetchInventory();
      await writeMobileCache(MOBILE_CACHE_KEYS.inventory, inventory);
      if (inventory) {
        setActiveUploadId(inventory.id ?? null);
        setFileName(inventory.fileName);
        setFileFormat(inventory.fileFormat ?? null);
        setSourceSystem(inventory.sourceSystem);
        setWarnings(inventory.warnings ?? []);
        setItems(inventory.items);
      } else {
        setActiveUploadId(null);
        setFileName(null);
        setFileFormat(null);
        setSourceSystem(undefined);
        setWarnings([]);
        setItems([]);
      }
    } catch (loadError) {
      if (cachedInventory === null) {
        setError(visibleUploadError(loadError, "Failed to load uploads."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadInventory();
    }, [loadInventory]),
  );

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

  async function pickAuditFile() {
    setError(null);
    const DocumentPicker = await import("expo-document-picker");
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        "application/pdf",
        "text/csv",
        "application/csv",
        "application/vnd.ms-excel",
        "text/comma-separated-values",
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setUploading(true);

    try {
      const inventory = await uploadInventoryFile(asset.uri, asset.name, asset.mimeType);
      setActiveUploadId(inventory.uploadId ?? null);
      setFileName(inventory.fileName);
      setFileFormat(inventory.fileFormat);
      setSourceSystem(inventory.sourceSystem);
      setWarnings(inventory.warnings);
      setItems(inventory.items);
      setSearch("");
      await clearMobileCache(MOBILE_CACHE_KEYS.audit);
      await loadInventory();
    } catch (uploadError) {
      setError(visibleUploadError(uploadError, "Upload failed."));
    } finally {
      setUploading(false);
    }
  }

  function confirmDeleteCurrentUpload() {
    if (!activeUploadId || !fileName) return;
    Alert.alert(
      "Remove current audit file?",
      `"${fileName}" will be removed from the active audit but kept in audit file history. You can permanently delete it from the history screen.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await archiveInventoryUpload(activeUploadId);
                await Promise.all([
                  clearMobileCache(MOBILE_CACHE_KEYS.audit),
                  clearMobileCache(MOBILE_CACHE_KEYS.inventory),
                  clearMobileCache(MOBILE_CACHE_KEYS.uploadHistory),
                ]);
                await loadInventory();
              } catch (deleteError) {
                setError(
                  deleteError instanceof Error ? deleteError.message : "Delete failed.",
                );
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <Screen style={styles.container}>
      <ScreenSubtitle>
        Upload a PDF or CSV audit file. We normalize VINs and available vehicle details.
      </ScreenSubtitle>
      <Pressable
        style={[styles.uploadCard, uploading && styles.uploadCardDisabled]}
        onPress={() => void pickAuditFile()}
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
          <Text style={styles.uploadTitle} numberOfLines={1}>
            {uploading
              ? "Processing audit file…"
              : fileName
                ? fileName
                : "Choose Audit File"}
          </Text>
          <Text style={styles.uploadHint}>
            {fileName
              ? "Tap to choose a different PDF or CSV"
              : "Select a PDF or CSV from your device"}
          </Text>
        </View>
        {fileName && activeUploadId ? (
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
              confirmDeleteCurrentUpload();
            }}
            accessibilityLabel={`Delete ${fileName}`}
            style={styles.currentDeleteBtn}
          >
            <Ionicons name="trash-outline" size={21} color={colors.danger} />
          </Pressable>
        ) : (
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        )}
      </Pressable>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {fileName ? (
        <View style={styles.metaRow}>
          <Ionicons name="checkmark-circle" size={16} color={colors.primary} />
          <Text style={styles.meta}>
            {items.length} vehicles · {(fileFormat ?? "pdf").toUpperCase()} · {formatSource(sourceSystem)}
          </Text>
        </View>
      ) : null}

      {warnings.length > 0 ? (
        <View style={styles.warningBox}>
          <Text style={styles.warningTitle}>
            Imported with {warnings.length} warning{warnings.length === 1 ? "" : "s"}
          </Text>
          {warnings.slice(0, 3).map((warning, index) => (
            <Text key={`${warning}-${index}`} style={styles.warningText}>
              • {warning}
            </Text>
          ))}
          {warnings.length > 3 ? (
            <Text style={styles.warningText}>+ {warnings.length - 3} more</Text>
          ) : null}
        </View>
      ) : null}

      <Pressable
        style={styles.historyButton}
        onPress={() => router.push("/upload-history" as never)}
      >
        <View style={styles.historyIcon}>
          <Ionicons name="time-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.historyCopy}>
          <Text style={styles.historyTitle}>Audit file history</Text>
          <Text style={styles.historyHint}>View or remove previous audit files</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </Pressable>

      <VinSearchInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
      />

      {loading ? (
        <SkeletonCards />
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
  currentDeleteBtn: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
  },
  meta: { color: colors.textSecondary, fontSize: 13, flex: 1 },
  warningBox: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.warning,
    backgroundColor: colors.warningLight,
  },
  warningTitle: { color: colors.text, fontSize: 12, fontWeight: "800" },
  warningText: { color: colors.textSecondary, fontSize: 11, marginTop: 4 },
  historyButton: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  historyCopy: { flex: 1 },
  historyTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  historyHint: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  search: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  loader: { marginTop: spacing.xxl },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 132 },
  vin: {
    ...typography.vin,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  model: { fontWeight: "600", marginTop: spacing.xs, color: colors.text, fontSize: 15 },
  detail: { color: colors.textSecondary, marginTop: 2, fontSize: 13 },
});
