import Ionicons from "@expo/vector-icons/Ionicons";
import { StyleSheet, Text, View } from "react-native";

import { KeyboardModalSheet } from "@/components/keyboard-modal-sheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { colors, spacing, typography } from "@/constants/theme";
import type { ScannedVehicle } from "@/lib/types";
import { formatVinPrimary } from "@/lib/vin-display";
import {
  formatVehicleTitle,
  getVehicleDisplay,
  visibleVehicleColor,
} from "@/lib/vehicle-display";

type Props = {
  visible: boolean;
  vehicles: ScannedVehicle[];
  onClose: () => void;
  onSelect: (vehicle: ScannedVehicle) => void;
};

export function CoLocatedVehiclesModal({
  visible,
  vehicles,
  onClose,
  onSelect,
}: Props) {
  const singleVehicle = vehicles.length === 1;

  return (
    <KeyboardModalSheet visible={visible} onClose={onClose}>
      <View style={styles.heading}>
        <View style={styles.headingIcon}>
          <Ionicons name="location" size={24} color={colors.onPrimary} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>
            {singleVehicle ? "Vehicle on the map" : "Vehicles in this area"}
          </Text>
          <Text style={styles.subtitle}>
            {singleVehicle
              ? "Tap the vehicle below to open its full history."
              : `${vehicles.length} nearby vehicles are grouped on this marker.`}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {vehicles.map((vehicle, index) => {
          const display = getVehicleDisplay(vehicle);
          const color = visibleVehicleColor(display.color);
          return (
            <Card
              key={vehicle.id}
              style={styles.vehicleCard}
              onPress={() => {
                onSelect(vehicle);
                onClose();
              }}
            >
              <View style={styles.vehicleRow}>
                <View style={styles.numberBadge}>
                  <Text style={styles.numberText}>{index + 1}</Text>
                </View>
                <View style={styles.vehicleCopy}>
                  <Text style={styles.vin}>
                    {formatVinPrimary(vehicle.vin, vehicle.vinSuffix)}
                  </Text>
                  <Text style={styles.model} numberOfLines={2}>
                    {formatVehicleTitle(display)}
                  </Text>
                  {color ? <Text style={styles.detail}>{color}</Text> : null}
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.primary} />
              </View>
            </Card>
          );
        })}
      </View>

      <Button label="Cancel" variant="secondary" onPress={onClose} />
    </KeyboardModalSheet>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  headingIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  headingCopy: { flex: 1 },
  title: { fontSize: 22, fontWeight: "900", color: colors.text },
  subtitle: {
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 19,
  },
  list: { gap: spacing.sm, marginBottom: spacing.md },
  vehicleCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  numberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  numberText: { color: colors.primaryDark, fontWeight: "900", fontSize: 13 },
  vehicleCopy: { flex: 1 },
  vin: { ...typography.vin, fontSize: 14, fontWeight: "700", color: colors.text },
  model: { fontWeight: "600", marginTop: spacing.xs, color: colors.text },
  detail: { color: colors.textSecondary, marginTop: 2, fontSize: 13 },
});
