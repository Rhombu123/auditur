import { Pressable, StyleSheet, Text, View } from "react-native";

import { KeyboardModalSheet } from "@/components/keyboard-modal-sheet";
import { Button } from "@/components/ui/button";
import { colors, radius, spacing } from "@/constants/theme";
import { ZONE_COLOR_OPTIONS, type ZoneColorOption } from "@/lib/zone-colors";
import type { LotZone } from "@/lib/types";

type Props = {
  zone: LotZone | null;
  visible: boolean;
  onClose: () => void;
  onSave: (colors: { fillColor: string; strokeColor: string }) => Promise<void>;
};

export function ZoneColorModal({ zone, visible, onClose, onSave }: Props) {
  const current =
    ZONE_COLOR_OPTIONS.find(
      (option) => option.stroke.toLowerCase() === zone?.strokeColor.toLowerCase(),
    ) ?? ZONE_COLOR_OPTIONS[0];

  return (
    <KeyboardModalSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Section color</Text>
      <Text style={styles.hint}>
        {zone ? `"${zone.name}" — used on the map and audit PDF highlights.` : ""}
      </Text>

      <View style={styles.grid}>
        {ZONE_COLOR_OPTIONS.map((option) => (
          <ColorOption
            key={option.id}
            option={option}
            selected={option.id === current.id}
            onPress={() => void onSave({ fillColor: option.fill, strokeColor: option.stroke }).then(onClose)}
          />
        ))}
      </View>

      <Button label="Cancel" variant="secondary" onPress={onClose} />
    </KeyboardModalSheet>
  );
}

function ColorOption({
  option,
  selected,
  onPress,
}: {
  option: ZoneColorOption;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.swatch, selected && styles.swatchSelected]}
      onPress={onPress}
    >
      <View style={[styles.swatchColor, { backgroundColor: option.stroke }]} />
      <Text style={styles.swatchLabel}>{option.label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: "800", color: colors.text },
  hint: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  swatch: {
    width: "30%",
    minWidth: 96,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm,
    alignItems: "center",
    gap: spacing.xs,
  },
  swatchSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  swatchColor: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
  },
  swatchLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
  },
});
