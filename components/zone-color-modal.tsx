import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import ColorPicker, {
  HueSlider,
  Panel1,
  type ColorFormatsObject,
} from "reanimated-color-picker";

import { KeyboardModalSheet } from "@/components/keyboard-modal-sheet";
import { Button } from "@/components/ui/button";
import { colors, radius, spacing } from "@/constants/theme";
import { ZONE_COLOR_OPTIONS, type ZoneColorOption } from "@/lib/zone-colors";
import type { LotZone } from "@/lib/types";

type Props = {
  zone: LotZone | null;
  visible: boolean;
  initialColor?: string;
  sectionName?: string;
  onClose: () => void;
  onSave: (colors: { fillColor: string; strokeColor: string }) => Promise<void>;
};

function fillFromHex(hex: string): string {
  const value = Number.parseInt(hex.replace("#", ""), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, 0.35)`;
}

export function ZoneColorModal({
  zone,
  visible,
  initialColor,
  sectionName,
  onClose,
  onSave,
}: Props) {
  const current =
    ZONE_COLOR_OPTIONS.find(
      (option) =>
        option.stroke.toLowerCase() ===
        (initialColor ?? zone?.strokeColor ?? "").toLowerCase(),
    ) ?? ZONE_COLOR_OPTIONS[0];
  const [customColor, setCustomColor] = useState(initialColor ?? zone?.strokeColor ?? current.stroke);

  useEffect(() => {
    if (!visible) return;
    setCustomColor(initialColor ?? zone?.strokeColor ?? current.stroke);
  }, [current.stroke, initialColor, visible, zone?.strokeColor]);

  return (
    <KeyboardModalSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Section color</Text>
      <Text style={styles.hint}>
        {`"${sectionName ?? zone?.name ?? "New section"}" — used on the map and audit PDF.`}
      </Text>

      <View style={styles.swatchRow}>
        {ZONE_COLOR_OPTIONS.map((option) => (
          <ColorOption
            key={option.id}
            option={option}
            selected={option.id === current.id}
            onPress={() => void onSave({ fillColor: option.fill, strokeColor: option.stroke }).then(onClose)}
          />
        ))}
      </View>

      <ColorPicker
        key={`${visible}-${initialColor ?? zone?.strokeColor ?? current.stroke}`}
        value={customColor}
        onChangeJS={(colors: ColorFormatsObject) => setCustomColor(colors.hex)}
        style={styles.picker}
      >
        <Panel1 style={styles.panel} />
        <HueSlider style={styles.hue} />
      </ColorPicker>

      <View style={styles.actions}>
        <Button
          label="Use this color"
          onPress={() =>
            void onSave({
              strokeColor: customColor,
              fillColor: fillFromHex(customColor),
            }).then(onClose)
          }
        />
        <Button label="Cancel" variant="secondary" onPress={onClose} />
      </View>
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
      accessibilityLabel={option.label}
    >
      <View style={[styles.swatchColor, { backgroundColor: option.stroke }]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "900", color: colors.text },
  hint: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  swatchRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  swatch: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  swatchSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  swatchColor: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
  },
  picker: { gap: spacing.md, marginBottom: spacing.lg },
  panel: { height: 170, borderRadius: radius.lg },
  hue: { height: 24, borderRadius: radius.pill },
  actions: { gap: spacing.sm },
});
