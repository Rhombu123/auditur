import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { MotiView } from "moti";

import { KeyboardModalSheet } from "@/components/keyboard-modal-sheet";
import { Button } from "@/components/ui/button";
import { colors, radius, spacing, typography } from "@/constants/theme";
import type { InventoryItem } from "@/lib/types";
import { formatVinPrimary, formatVinSecondary } from "@/lib/vin-display";
import { formatVehicleTitle, getVehicleDisplay } from "@/lib/vehicle-display";

export type ScanResultSummary = {
  vin: string | null;
  vinSuffix: string;
  vehicle: InventoryItem;
  inventoryMatched: boolean;
  isRescan: boolean;
  scanId: string;
};

type Props = {
  visible: boolean;
  loading: boolean;
  result: ScanResultSummary | null;
  error?: string | null;
  onViewVehicle: () => void;
  onScanAnother: () => void;
};

export function ScanResultModal({
  visible,
  loading,
  result,
  error,
  onViewVehicle,
  onScanAnother,
}: Props) {
  const display = result ? getVehicleDisplay(result.vehicle) : null;

  return (
    <KeyboardModalSheet visible={visible} onClose={onScanAnother} centered>
      <MotiView
        from={{ opacity: 0, scale: 0.94, translateY: 16 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: "spring", damping: 20 }}
      >
        {loading ? (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.loadingTitle}>Looking up vehicle…</Text>
            <Text style={styles.loadingHint}>
              Saving scan and loading year, model, and color.
            </Text>
          </>
        ) : error ? (
          <>
            <Text style={styles.errorTitle}>Scan failed</Text>
            <Text style={styles.errorText}>{error}</Text>
            <Button label="Try again" variant="secondary" onPress={onScanAnother} />
          </>
        ) : result && display ? (
          <>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {result.isRescan ? "Location updated" : "Vehicle scanned"}
              </Text>
            </View>
            <Text style={styles.title}>{formatVehicleTitle(display)}</Text>
            <Text style={styles.vin}>
              {formatVinPrimary(result.vin, result.vinSuffix)}
            </Text>
            {formatVinSecondary(result.vin, result.vinSuffix) ? (
              <Text style={styles.vinMeta}>
                {formatVinSecondary(result.vin, result.vinSuffix)}
              </Text>
            ) : null}
            <View style={styles.details}>
              <Text style={styles.detailLine}>
                <Text style={styles.detailLabel}>Color: </Text>
                {display.color}
              </Text>
              {result.vehicle.daysOnLot != null ? (
                <Text style={styles.detailLine}>
                  <Text style={styles.detailLabel}>Days on lot: </Text>
                  {result.vehicle.daysOnLot}
                </Text>
              ) : null}
              {result.vehicle.miles != null ? (
                <Text style={styles.detailLine}>
                  <Text style={styles.detailLabel}>Miles: </Text>
                  {result.vehicle.miles.toLocaleString()}
                </Text>
              ) : null}
              <Text style={styles.detailLine}>
                <Text style={styles.detailLabel}>Inventory: </Text>
                {result.inventoryMatched ? "Matched" : "Not on current list"}
              </Text>
            </View>
            <Button label="View vehicle" onPress={onViewVehicle} />
            <Button label="Scan another" variant="secondary" onPress={onScanAnother} />
          </>
        ) : null}
      </MotiView>
    </KeyboardModalSheet>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  badgeText: {
    color: colors.primaryDark,
    fontWeight: "700",
    fontSize: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    marginTop: spacing.xs,
  },
  vin: {
    ...typography.vin,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  vinMeta: { color: colors.textMuted, fontSize: 12 },
  details: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  detailLine: { color: colors.textSecondary, fontSize: 15 },
  detailLabel: { fontWeight: "700", color: colors.text },
  loadingTitle: {
    marginTop: spacing.md,
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  loadingHint: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.danger,
    textAlign: "center",
  },
  errorText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
});
