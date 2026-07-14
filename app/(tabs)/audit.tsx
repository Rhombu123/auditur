import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip, ChipRow } from "@/components/ui/chip";
import { EmptyState, ErrorText, Screen, ScreenSubtitle } from "@/components/ui/screen";
import { StatCard, StatRow } from "@/components/ui/stat-card";
import { colors, spacing, typography } from "@/constants/theme";
import { getErrorMessage } from "@/lib/errors";
import {
  MOBILE_CACHE_KEYS,
  readMobileCache,
  writeMobileCache,
} from "@/lib/mobile-cache";
import { fetchTodayAudit } from "@/lib/mobile-api";
import type { AuditVehicleRef, TodayAuditSummary } from "@/lib/types";
import { formatVinPrimary } from "@/lib/vin-display";

type AuditListFilter = "missing" | "extra" | "scanned";

function AuditListItem({
  item,
  onPress,
}: {
  item: AuditVehicleRef;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress}>
      <Text style={styles.vin}>{formatVinPrimary(null, item.vinSuffix)}</Text>
      <Text style={styles.model}>{item.model}</Text>
      <Text style={styles.detail}>
        {item.color}
        {item.scannerEmail ? ` · ${item.scannerEmail}` : ""}
        {item.scannedAt
          ? ` · ${new Date(item.scannedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
          : ""}
      </Text>
    </Card>
  );
}

export default function AuditScreen() {
  const router = useRouter();
  const [audit, setAudit] = useState<TodayAuditSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState<AuditListFilter>("missing");
  const [exporting, setExporting] = useState(false);

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
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : !audit ? (
        <EmptyState>
          Upload a price list on the Upload tab to start today&apos;s audit.
        </EmptyState>
      ) : (
        <>
          <View style={styles.progressCard}>
            <Text style={styles.progressValue}>{audit.completionPercent}%</Text>
            <Text style={styles.progressLabel}>Audit complete</Text>
            {audit.inventoryFileName ? (
              <Text style={styles.fileMeta}>{audit.inventoryFileName}</Text>
            ) : null}
            <Button
              label={exporting ? "Preparing PDF…" : "Export highlighted PDF"}
              variant="secondary"
              compact
              style={styles.exportBtn}
              onPress={() => void handleExportPdf()}
              disabled={exporting}
            />
          </View>

          <StatRow>
            <StatCard label="Expected" value={audit.expectedCount} accent />
            <StatCard label="Scanned today" value={audit.scannedTodayCount} />
            <StatCard label="Missing" value={audit.notScannedTodayCount} />
          </StatRow>

          <StatRow>
            <StatCard label="Not on list" value={audit.scannedNotOnListCount} />
          </StatRow>

          <ChipRow style={styles.chips}>
            <Chip
              label={`Missing (${audit.notScannedTodayCount})`}
              selected={listFilter === "missing"}
              onPress={() => setListFilter("missing")}
            />
            <Chip
              label={`Not on list (${audit.scannedNotOnListCount})`}
              selected={listFilter === "extra"}
              onPress={() => setListFilter("extra")}
            />
            <Chip
              label={`Scanned today (${audit.scannedToday.length})`}
              selected={listFilter === "scanned"}
              onPress={() => setListFilter("scanned")}
            />
          </ChipRow>

          <FlatList
            data={listData}
            keyExtractor={(item) => item.vinSuffix}
            contentContainerStyle={styles.list}
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
              <AuditListItem item={item} onPress={() => openVehicle(item.vinSuffix)} />
            )}
          />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loader: { marginTop: spacing.xxl },
  progressCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    padding: spacing.xl,
    alignItems: "center",
  },
  progressValue: {
    fontSize: 48,
    fontWeight: "800",
    color: colors.primaryDark,
    letterSpacing: -1,
  },
  progressLabel: {
    marginTop: spacing.xs,
    fontSize: 15,
    fontWeight: "700",
    color: colors.primaryDark,
  },
  fileMeta: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: "center",
  },
  exportBtn: {
    marginTop: spacing.md,
    alignSelf: "stretch",
  },
  chips: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  list: {
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  vin: {
    ...typography.vin,
    fontSize: 15,
    fontWeight: "800",
    color: colors.text,
  },
  model: { fontWeight: "600", marginTop: spacing.xs, color: colors.text },
  detail: { color: colors.textSecondary, marginTop: spacing.xs, fontSize: 13 },
});
