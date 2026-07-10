import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { KeyboardModalSheet } from "@/components/keyboard-modal-sheet";
import { Button } from "@/components/ui/button";
import { colors, radius, spacing } from "@/constants/theme";

type Props = {
  visible: boolean;
  pointCount: number;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
};

export function LotZoneNameModal({
  visible,
  pointCount,
  onClose,
  onSave,
}: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setName("");
  }, [visible]);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardModalSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Name this zone</Text>
      <Text style={styles.hint}>
        {pointCount} corner{pointCount === 1 ? "" : "s"} drawn. Reusing a name merges into the same
        zone and color.
      </Text>

      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Zone name"
        placeholderTextColor={colors.textMuted}
        autoFocus
      />

      <View style={styles.actions}>
        <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.actionBtn} />
        <Button
          label={saving ? "Saving…" : "Save zone"}
          onPress={() => void handleSave()}
          disabled={saving || !name.trim()}
          loading={saving}
          style={styles.actionBtn}
        />
      </View>
    </KeyboardModalSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  hint: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    marginTop: spacing.lg,
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
