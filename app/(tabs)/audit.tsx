import Ionicons from "@expo/vector-icons/Ionicons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorText, Screen, ScreenSubtitle } from "@/components/ui/screen";
import { SkeletonCards } from "@/components/ui/skeleton-card";
import { colors, spacing, typography } from "@/constants/theme";
import { useDealership } from "@/lib/dealership-context";
import { getErrorMessage } from "@/lib/errors";
import {
  MOBILE_CACHE_KEYS,
  readMobileCache,
  writeMobileCache,
} from "@/lib/mobile-cache";
import { useLiveMultiUserProgress } from "@/lib/live-progress";
import { fetchTodayAudit } from "@/lib/mobile-api";
import type { AuditVehicleRef, TodayAuditSummary } from "@/lib/types";
import { formatVinPrimary } from "@/lib/vin-display";

type AuditListFilter = "missing" | "extra" | "scanned";

function AuditListItem({
  item,
  kind,
  onPress,
}: {
  item: AuditVehicleRef;
  kind: AuditListFilter;
  onPress: () => void;
}) {
  const icon =
    kind === "missing" ? "alert" : kind === "extra" ? "add" : "checkmark";
  const accent =
    kind === "missing"
      ? colors.danger
      : kind === "extra"
        ? colors.warning
        : colors.success;

  return (
    <Card
      style={{ ...styles.auditCell, borderLeftColor: accent }}
      onPress={onPress}
    >
      <View style={styles.auditCellRow}>
        <View
          style={[
            styles.auditCellIcon,
            { backgroundColor: `${accent}16`, borderColor: `${accent}45` },
          ]}
        >
          <Ionicons
            name={icon}
            size={18}
            color={accent}
          />
        </View>
        <View style={styles.auditCellCopy}>
          <Text style={styles.vin}>{formatVinPrimary(null, item.vinSuffix)}</Text>
          <Text style={styles.model}>{item.model}</Text>
          <Text style={styles.detail}>
            {item.color}
            {item.scannerEmail ? ` · ${item.scannerEmail}` : ""}
            {item.scannedAt
              ? ` · ${new Date(item.scannedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : ""}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.primary} />
      </View>
    </Card>
  );
}

function AuditFilterButton({
  label,
  count,
  selected,
  onPress,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.filterButton, selected && styles.filterButtonSelected]}
      onPress={onPress}
    >
      <Text style={[styles.filterCount, selected && styles.filterTextSelected]}>
        {count}
      </Text>
      <Text style={[styles.filterLabel, selected && styles.filterTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function AuditScreen() {
  const router = useRouter();
  const { hasPermission } = useDealership();
  const [audit, setAudit] = useState<TodayAuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<AuditListFilter>("missing");
  const [exporting, setExporting] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    const cached = await readMobileCache<TodayAuditSummary>(MOBILE_CACHE_KEYS.audit);
    if (cached) {
      setAudit(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const fresh = await fetchTodayAudit();
      setAudit(fresh);
      await writeMobileCache(MOBILE_CACHE_KEYS.audit, fresh);
    } catch (loadError) {
      if (!cached) {
        setError(getErrorMessage(loadError, "Failed to load today's audit."));
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useLiveMultiUserProgress({ onScanChange: load });

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const listData =
    listFilter === "missing"
      ? audit?.missingToday ?? []
      : listFilter === "extra"
        ? audit?.scannedNotOnList ?? []
        : audit?.scannedToday ?? [];

  function openVehicle(vinSuffix: string) {
    router.push({
      pathname: "/vehicle/[vinSuffix]",
      params: { vinSuffix },
    });
  }

  async function handleExportPdf() {
    if (audit?.fileFormat === "csv") return;
    setExporting(true);
    setError(null);
    try {
      const { exportHighlightedAuditPdf } = await import("@/lib/export-audit-pdf");
      await exportHighlightedAuditPdf();
    } catch (exportError) {
      setError(getErrorMessage(exportError, "Could not export highlighted PDF."));
    } finally {
      setExporting(false);
    }
  }

  return (
    <Screen>
      <ScreenSubtitle>
        Compare your price list to today&apos;s scans. Review missing units before end of day.
      </ScreenSubtitle>
      {error ? <ErrorText>{error}</ErrorText> : null}

      {loading ? (
        <SkeletonCards count={3} showSummary />
      ) : !audit ? (
        <EmptyState>
          Upload a price list on the Upload tab to start today&apos;s audit.
        </EmptyState>
      ) : (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.compactHeader,
              {
                opacity: scrollY.interpolate({
                  inputRange: [150, 215],
                  outputRange: [0, 1],
                  extrapolate: "clamp",
                }),
                transform: [
                  {
                    translateY: scrollY.interpolate({
                      inputRange: [150, 215],
                      outputRange: [-18, 0],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.compactIcon}>
              <Ionicons name="clipboard" size={20} color={colors.primaryDark} />
            </View>
            <View style={styles.compactCopy}>
              <View style={styles.compactSummary}>
                <Text style={styles.compactLabel}>
                  {audit.scannedTodayCount} of {audit.expectedCount} vehicles scanned
                </Text>
                <Text style={styles.compactRemaining}>
                  {audit.notScannedTodayCount} remaining
                </Text>
              </View>
              <View style={styles.compactTrack}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width:
                        `${Math.max(0, Math.min(100, audit.completionPercent))}%` as `${number}%`,
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.compactPercent}>{audit.completionPercent}%</Text>
          </Animated.View>

          <Animated.FlatList
            data={listData}
            keyExtractor={(item) => item.vinSuffix}
            contentContainerStyle={styles.list}
            scrollEventThrottle={16}
            onScroll={Animated.event(
              [{ nativeEvent: { contentOffset: { y: scrollY } } }],
              { useNativeDriver: true },
            )}
            ListHeaderComponent={
              <>
                <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View style={styles.progressIcon}>
                <Ionicons
                  name="clipboard"
                  size={24}
                  color={colors.primaryDark}
                />
              </View>
              <View style={styles.progressHeadingCopy}>
                <Text style={styles.progressEyebrow}>Today&apos;s lot audit</Text>
                <Text style={styles.progressTitle}>Inventory reconciliation</Text>
              </View>
              <View style={styles.percentBadge}>
                <Text style={styles.progressValue}>{audit.completionPercent}%</Text>
              </View>
            </View>

            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width:
                      `${Math.max(0, Math.min(100, audit.completionPercent))}%` as `${number}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.progressSummary}>
              <Text style={styles.progressLabel}>
                {audit.scannedTodayCount} of {audit.expectedCount} vehicles scanned
              </Text>
              <Text style={styles.progressRemaining}>
                {audit.notScannedTodayCount} remaining
              </Text>
            </View>

            {audit.inventoryFileName ? (
              <View style={styles.filePill}>
                <Ionicons
                  name="document-text-outline"
                  size={16}
                  color={colors.tabInactive}
                />
                <Text style={styles.fileMeta} numberOfLines={1}>
                  {audit.inventoryFileName}
                </Text>
              </View>
            ) : null}

            <View style={styles.attentionRow}>
              <View style={styles.attentionMetric}>
                <View style={[styles.metricDot, styles.missingDot]} />
                <View>
                  <Text style={styles.attentionValue}>
                    {audit.notScannedTodayCount}
                  </Text>
                  <Text style={styles.attentionLabel}>Missing</Text>
                </View>
              </View>
              <View style={styles.metricDivider} />
              <View style={styles.attentionMetric}>
                <View style={[styles.metricDot, styles.extraDot]} />
                <View>
                  <Text style={styles.attentionValue}>
                    {audit.scannedNotOnListCount}
                  </Text>
                  <Text style={styles.attentionLabel}>Not on list</Text>
                </View>
              </View>
            </View>

            {hasPermission("export_audits") ? (
              <>
                <Button
                  label={
                    audit.fileFormat === "csv"
                      ? "Highlighted PDF unavailable"
                      : exporting
                        ? "Preparing PDF…"
                        : "Export highlighted PDF"
                  }
                  variant="secondary"
                  compact
                  style={styles.exportBtn}
                  onPress={() => void handleExportPdf()}
                  disabled={exporting || audit.fileFormat === "csv"}
                />
                {audit.fileFormat === "csv" ? (
                  <Text style={styles.exportUnavailable}>
                    CSV-backed audits do not have an original PDF to highlight.
                  </Text>
                ) : null}
              </>
            ) : null}
          </View>

          <View style={styles.filters}>
            <AuditFilterButton
              label="Missing"
              count={audit.notScannedTodayCount}
              selected={listFilter === "missing"}
              onPress={() => setListFilter("missing")}
            />
            <AuditFilterButton
              label="Not listed"
              count={audit.scannedNotOnListCount}
              selected={listFilter === "extra"}
              onPress={() => setListFilter("extra")}
            />
            <AuditFilterButton
              label="Scanned"
              count={audit.scannedToday.length}
              selected={listFilter === "scanned"}
              onPress={() => setListFilter("scanned")}
            />
          </View>
              </>
            }
            ListEmptyComponent={
              <EmptyState>
                {listFilter === "missing"
                  ? "Every vehicle on the list was scanned today."
                  : listFilter === "extra"
                    ? "No extra scans outside the price list today."
                    : "No scans yet today."}
              </EmptyState>
            }
            renderItem={({ item }) => (
              <View style={styles.listItem}>
                <AuditListItem
                  item={item}
                  kind={listFilter}
                  onPress={() => openVehicle(item.vinSuffix)}
                />
              </View>
            )}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  compactHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    minHeight: 76,
    zIndex: 30,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.tabBar,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: colors.tabBar,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  compactIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  compactCopy: { flex: 1, minWidth: 0 },
  compactSummary: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  compactLabel: { color: colors.onPrimary, fontSize: 11, fontWeight: "800" },
  compactRemaining: {
    color: colors.tabInactive,
    fontSize: 10,
    fontWeight: "700",
  },
  compactTrack: {
    height: 7,
    marginTop: spacing.sm,
    overflow: "hidden",
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  compactPercent: {
    minWidth: 42,
    color: colors.onPrimary,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "right",
  },
  auditCell: {
    borderLeftWidth: 4,
  },
  auditCellRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  auditCellIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  auditCellCopy: { flex: 1, minWidth: 0 },
  progressCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.tabBar,
    borderRadius: 24,
    padding: spacing.xl,
    ...{
      shadowColor: colors.tabBar,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
      elevation: 8,
    },
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  progressIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  progressHeadingCopy: { flex: 1 },
  progressEyebrow: {
    color: colors.tabInactive,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  progressTitle: {
    marginTop: 3,
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
  percentBadge: {
    minWidth: 66,
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  progressValue: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.onPrimary,
  },
  progressTrack: {
    height: 10,
    marginTop: spacing.xl,
    overflow: "hidden",
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  progressSummary: {
    marginTop: spacing.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  progressLabel: {
    color: colors.onPrimary,
    fontSize: 13,
    fontWeight: "700",
  },
  progressRemaining: {
    color: colors.tabInactive,
    fontSize: 12,
    fontWeight: "700",
  },
  filePill: {
    marginTop: spacing.md,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  fileMeta: {
    flex: 1,
    fontSize: 12,
    color: colors.tabInactive,
  },
  attentionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.16)",
  },
  attentionMetric: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  metricDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  missingDot: { backgroundColor: "#FF6B63" },
  extraDot: { backgroundColor: "#FFC857" },
  metricDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  attentionValue: { color: colors.onPrimary, fontSize: 20, fontWeight: "900" },
  attentionLabel: { color: colors.tabInactive, fontSize: 11, fontWeight: "700" },
  exportBtn: {
    marginTop: spacing.lg,
    alignSelf: "stretch",
  },
  exportUnavailable: {
    marginTop: spacing.sm,
    color: colors.tabInactive,
    fontSize: 11,
    textAlign: "center",
  },
  filters: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  filterButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  filterButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  filterCount: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
  },
  filterLabel: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: "700",
  },
  filterTextSelected: {
    color: colors.primaryDark,
  },
  list: {
    paddingBottom: 132,
  },
  listItem: { paddingHorizontal: spacing.lg },
  vin: {
    ...typography.vin,
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  model: { fontWeight: "600", marginTop: spacing.xs, color: colors.text },
  detail: { color: colors.textSecondary, marginTop: spacing.xs, fontSize: 13 },
});
