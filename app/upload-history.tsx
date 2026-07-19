import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Card } from "@/components/ui/card";
import { EmptyState, ErrorText } from "@/components/ui/screen";
import { SkeletonCards } from "@/components/ui/skeleton-card";
import { colors, radius, spacing } from "@/constants/theme";
import { getErrorMessage } from "@/lib/errors";
import {
  clearMobileCache,
  MOBILE_CACHE_KEYS,
} from "@/lib/mobile-cache";
import {
  deleteInventoryUpload,
  fetchUploadHistory,
} from "@/lib/mobile-api";
import { goBackOrHome } from "@/lib/navigation";
import type { InventoryUploadLog } from "@/lib/types";

function formatUploadedAt(value: string): string {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSource(sourceSystem: string | undefined): string {
  if (!sourceSystem || sourceSystem === "unknown") return "Unknown source";
  return sourceSystem
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function UploadHistoryScreen() {
  const router = useRouter();
  const [uploads, setUploads] = useState<InventoryUploadLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUploads(await fetchUploadHistory());
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load audit file history."));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function confirmDelete(entry: InventoryUploadLog) {
    Alert.alert(
      "Permanently delete this audit file?",
      `"${entry.fileName}", its stored file, and its imported inventory rows will be permanently deleted. Scan history stays intact.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setDeletingId(entry.id);
              setError(null);
              try {
                await deleteInventoryUpload(entry.id);
                await Promise.all([
                  clearMobileCache(MOBILE_CACHE_KEYS.inventory),
                  clearMobileCache(MOBILE_CACHE_KEYS.uploadHistory),
                  clearMobileCache(MOBILE_CACHE_KEYS.audit),
                ]);
                await load();
              } catch (deleteError) {
                setError(getErrorMessage(deleteError, "Could not delete audit file."));
              } finally {
                setDeletingId(null);
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => goBackOrHome(router)}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.primary} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Audit file history</Text>
          <Text style={styles.subtitle}>Audit files imported for this dealership</Text>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {error ? <ErrorText>{error}</ErrorText> : null}

      {loading ? (
        <SkeletonCards count={3} />
      ) : (
        <FlatList
          data={uploads}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState>No audit files have been uploaded yet.</EmptyState>
          }
          renderItem={({ item }) => (
            <Card style={styles.logCard}>
              <View style={styles.logRow}>
                <View style={styles.documentIcon}>
                  <Ionicons
                    name="document-text"
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.logCopy}>
                  <View style={styles.nameRow}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {item.fileName}
                    </Text>
                    {item.isCurrent ? (
                      <View style={styles.activeBadge}>
                        <Text style={styles.activeBadgeText}>Current</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.meta}>
                    {formatUploadedAt(item.uploadedAt)}
                  </Text>
                  <Text style={styles.itemCount}>
                    {item.itemCount} vehicle{item.itemCount === 1 ? "" : "s"} imported
                    {" · "}{(item.fileFormat ?? "pdf").toUpperCase()}
                    {" · "}{formatSource(item.sourceSystem)}
                  </Text>
                  {!item.hasStoredPdf ? (
                    <Text style={styles.exportUnavailable}>
                      Highlighted-PDF export unavailable for this audit
                    </Text>
                  ) : null}
                  {item.warnings.length > 0 ? (
                    <View style={styles.warningBox}>
                      <Text style={styles.warningTitle}>
                        {item.warnings.length} import warning{item.warnings.length === 1 ? "" : "s"}
                      </Text>
                      {item.warnings.slice(0, 2).map((warning, index) => (
                        <Text key={`${warning}-${index}`} style={styles.warningText}>
                          • {warning}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  <View
                    style={[
                      styles.usageBadge,
                      item.scanCount > 0
                        ? styles.usageBadgeUsed
                        : styles.usageBadgeUnused,
                    ]}
                  >
                    <Ionicons
                      name={item.scanCount > 0 ? "checkmark-done" : "ellipse-outline"}
                      size={13}
                      color={
                        item.scanCount > 0
                          ? colors.primaryDark
                          : colors.textMuted
                      }
                    />
                    <Text
                      style={[
                        styles.usageText,
                        item.scanCount > 0 && styles.usageTextUsed,
                      ]}
                    >
                      {item.scanCount > 0
                        ? `Used in audit · ${item.scanCount} scan${item.scanCount === 1 ? "" : "s"}${
                            item.lastUsedAt
                              ? ` · ${formatUploadedAt(item.lastUsedAt)}`
                              : ""
                          }`
                        : "Not used in an audit yet"}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={styles.deleteButton}
                  onPress={() => confirmDelete(item)}
                  disabled={deletingId === item.id}
                  accessibilityLabel={`Delete ${item.fileName}`}
                >
                  {deletingId === item.id ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <Ionicons
                      name="trash-outline"
                      size={20}
                      color={colors.danger}
                    />
                  )}
                </Pressable>
              </View>
            </Card>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  headerCopy: { flex: 1, alignItems: "center" },
  headerSpacer: { width: 42 },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  subtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "600",
  },
  loader: { marginTop: spacing.xxxl },
  list: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  logCard: {
    padding: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  logRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  documentIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  logCopy: { flex: 1, minWidth: 0 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  fileName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "800" },
  activeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  activeBadgeText: { color: colors.primaryDark, fontSize: 10, fontWeight: "800" },
  meta: { marginTop: spacing.xs, color: colors.textSecondary, fontSize: 12 },
  itemCount: { marginTop: 2, color: colors.textMuted, fontSize: 12 },
  exportUnavailable: {
    marginTop: 4,
    color: colors.warning,
    fontSize: 11,
    fontWeight: "700",
  },
  warningBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.warningLight,
  },
  warningTitle: { color: colors.text, fontSize: 10, fontWeight: "800" },
  warningText: { color: colors.textSecondary, fontSize: 10, marginTop: 3 },
  usageBadge: {
    alignSelf: "flex-start",
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
  },
  usageBadgeUsed: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryBorder,
  },
  usageBadgeUnused: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
  },
  usageText: { color: colors.textMuted, fontSize: 10, fontWeight: "700" },
  usageTextUsed: { color: colors.primaryDark },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.dangerBorder,
  },
});
