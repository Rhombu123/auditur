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
    <KeyboardModalSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Edit vehicle</Text>
      <Text style={styles.vin}>
        {vehicle ? formatVinPrimary(vehicle.vin, vehicle.vinSuffix) : ""}
      </Text>
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
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  vin: {
    ...typography.vin,
    fontSize: 14,
    fontWeight: "700",
    marginTop: spacing.xs,
    color: colors.primary,
  },
  vinMeta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
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
  actions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.xl },
  actionBtn: { flex: 1, borderRadius: radius.md },
});
