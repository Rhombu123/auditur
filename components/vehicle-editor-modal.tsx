import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { KeyboardModalSheet } from "@/components/keyboard-modal-sheet";
import { Button } from "@/components/ui/button";
import { colors, radius, spacing, typography } from "@/constants/theme";
import type { ScannedVehicle } from "@/lib/types";
import { formatVinPrimary, formatVinSecondary } from "@/lib/vin-display";

type Props = {
  vehicle: ScannedVehicle | null;
  visible: boolean;
  onClose: () => void;
  onSave: (id: string, model: string, color: string) => Promise<void>;
};

export function VehicleEditorModal({
  vehicle,
  visible,
  onClose,
  onSave,
}: Props) {
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vehicle) {
      setModel(vehicle.model);
      setColor(vehicle.color === "Unknown" ? "" : vehicle.color);
    }
  }, [vehicle]);

  async function handleSave() {
    if (!vehicle) return;
    setSaving(true);
    try {
      await onSave(vehicle.id, model.trim() || `Vehicle ${vehicle.vinSuffix}`, color.trim() || "Unknown");
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardModalSheet visible={visible} onClose={onClose} centered>
      <View style={styles.heading}>
        <View style={styles.headingIcon}>
          <Ionicons name="car-sport" size={24} color={colors.onPrimary} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Edit vehicle</Text>
          <Text style={styles.vin}>
            {vehicle ? formatVinPrimary(vehicle.vin, vehicle.vinSuffix) : ""}
          </Text>
        </View>
      </View>
      {vehicle && formatVinSecondary(vehicle.vin, vehicle.vinSuffix) ? (
        <Text style={styles.vinMeta}>
          {formatVinSecondary(vehicle.vin, vehicle.vinSuffix)}
        </Text>
      ) : null}

      <Text style={styles.label}>Year & model</Text>
      <TextInput
        style={styles.input}
        value={model}
        onChangeText={setModel}
        placeholder="e.g. 2024 Ford Explorer"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>Color</Text>
      <TextInput
        style={styles.input}
        value={color}
        onChangeText={setColor}
        placeholder="e.g. Silver"
        placeholderTextColor={colors.textMuted}
      />

      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.actionBtn} />
        <Button
          label={saving ? "Saving…" : "Save"}
          onPress={() => void handleSave()}
          disabled={saving}
          loading={saving}
          style={styles.actionBtn}
        />
      </View>
    </KeyboardModalSheet>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.sm,
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
  title: { fontSize: 24, fontWeight: "900", color: colors.text },
  vin: {
    ...typography.vin,
    fontSize: 14,
    fontWeight: "700",
    marginTop: 2,
    color: colors.primary,
  },
  vinMeta: {
    ...typography.vin,
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900",
    marginBottom: spacing.sm,
    paddingLeft: 60,
  },
  label: { marginTop: spacing.lg, marginBottom: spacing.sm, color: colors.textSecondary, fontWeight: "600" },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.text,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.xxl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: { flex: 1, borderRadius: radius.md },
});
