import { StyleSheet, Text, View } from "react-native";

import { KeyboardModalSheet } from "@/components/keyboard-modal-sheet";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { colors, spacing, typography } from "@/constants/theme";
import type { ScannedVehicle } from "@/lib/types";
import { formatVinPrimary } from "@/lib/vin-display";
import { formatVehicleTitle, getVehicleDisplay } from "@/lib/vehicle-display";

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
  return (
    <KeyboardModalSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Multiple vehicles here</Text>
      <Text style={styles.subtitle}>
        {vehicles.length} vehicles share this spot — pick one
      </Text>

      <View style={styles.list}>
        {vehicles.map((vehicle) => {
          const display = getVehicleDisplay(vehicle);
          return (
            <Card
              key={vehicle.id}
              active
              onPress={() => {
                onSelect(vehicle);
                onClose();
              }}
            >
              <Text style={styles.vin}>{formatVinPrimary(vehicle.vin, vehicle.vinSuffix)}</Text>
              <Text style={styles.model} numberOfLines={2}>
                {formatVehicleTitle(display)}
              </Text>
              <Text style={styles.detail}>{display.color}</Text>
            </Card>
          );
        })}
      </View>

      <Button label="Cancel" variant="secondary" onPress={onClose} />
    </KeyboardModalSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  subtitle: { color: colors.textSecondary, marginTop: spacing.xs, marginBottom: spacing.md },
  list: { gap: spacing.sm, marginBottom: spacing.md },
  vin: { ...typography.vin, fontSize: 14, fontWeight: "700", color: colors.text },
  model: { fontWeight: "600", marginTop: spacing.xs, color: colors.text },
  detail: { color: colors.textSecondary, marginTop: 2, fontSize: 13 },
});
