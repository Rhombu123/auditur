import Ionicons from "@expo/vector-icons/Ionicons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { MotiView } from "moti";

import { KeyboardModalSheet } from "@/components/keyboard-modal-sheet";
import { Button } from "@/components/ui/button";
import { colors, radius, spacing, typography } from "@/constants/theme";
import type { InventoryItem } from "@/lib/types";
import { formatVinPrimary, formatVinSecondary } from "@/lib/vin-display";
import {
  formatVehicleTitle,
  getVehicleDisplay,
  visibleVehicleColor,
} from "@/lib/vehicle-display";

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
  const color = display ? visibleVehicleColor(display.color) : null;

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
            <View style={styles.successRow}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={24} color={colors.onPrimary} />
              </View>
              <View>
                <Text style={styles.successTitle}>Scan saved</Text>
                <Text style={styles.successHint}>
                  {result.isRescan ? "Vehicle location updated" : "Vehicle added to today’s audit"}
                </Text>
              </View>
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
              {color ? (
                <Text style={styles.detailLine}>
                  <Text style={styles.detailLabel}>Color: </Text>
                  {color}
                </Text>
              ) : null}
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
            <View style={styles.buttonStack}>
              <Button label="View vehicle" onPress={onViewVehicle} />
              <Button label="Scan another" variant="secondary" onPress={onScanAnother} />
            </View>
          </>
        ) : null}
      </MotiView>
    </KeyboardModalSheet>
  );
}

const styles = StyleSheet.create({
  successRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  successIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.success,
  },
  successTitle: {
    color: colors.primaryDark,
    fontWeight: "800",
    fontSize: 15,
  },
  successHint: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
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
  buttonStack: {
    marginTop: spacing.md,
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
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
