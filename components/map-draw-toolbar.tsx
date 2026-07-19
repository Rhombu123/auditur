import Ionicons from "@expo/vector-icons/Ionicons";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

import { colors, radius, shadow, spacing } from "@/constants/theme";
import type { ZoneShapeKind } from "@/lib/zone-shapes";

export type ZoneEditorTool = ZoneShapeKind | "highlight" | "eraser" | "move";

type Props = {
  visible: boolean;
  tool: ZoneEditorTool;
  editing: boolean;
  shapeCount: number;
  color: string;
  canUndo: boolean;
  onSelectTool: (tool: ZoneEditorTool) => void;
  onUndo: () => void;
  onColorPress: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDeleteZone?: () => void;
};

const TOOLS: {
  id: ZoneEditorTool;
  label: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  materialIcon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
}[] = [
  { id: "highlight", label: "Paint", icon: "brush-outline" },
  { id: "eraser", label: "Erase", materialIcon: "eraser" },
  { id: "move", label: "Move", icon: "move-outline" },
  { id: "rectangle", label: "Rectangle", icon: "tablet-landscape-outline" },
  { id: "oval", label: "Oval", icon: "ellipse-outline" },
];

function IconButton({
  icon,
  materialIcon,
  label,
  selected = false,
  disabled = false,
  danger = false,
  onPress,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  materialIcon?: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  selected?: boolean;
  disabled?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        selected && styles.buttonSelected,
        danger && styles.buttonDanger,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      pressRetentionOffset={12}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
    >
      {materialIcon ? (
        <MaterialCommunityIcons
          name={materialIcon}
          size={22}
          color={
            selected
              ? colors.onPrimary
              : danger
                ? colors.danger
                : colors.textSecondary
          }
        />
      ) : icon ? (
        <Ionicons
          name={icon}
          size={21}
          color={
            selected
              ? colors.onPrimary
              : danger
                ? colors.danger
                : colors.textSecondary
          }
        />
      ) : null}
    </Pressable>
  );
}

export function MapDrawToolbar({
  visible,
  tool,
  editing,
  shapeCount,
  color,
  canUndo,
  onSelectTool,
  onUndo,
  onColorPress,
  onSave,
  onCancel,
  onDeleteZone,
}: Props) {
  if (!visible) return null;

  return (
    <View style={styles.toolbar}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.tools}
      >
        {TOOLS.map((entry) => (
          <IconButton
            key={entry.id}
            icon={entry.icon}
            materialIcon={entry.materialIcon}
            label={`${entry.label} tool`}
            selected={tool === entry.id}
            onPress={() => onSelectTool(entry.id)}
          />
        ))}

        <View style={styles.divider} />

        <IconButton
          icon="arrow-undo-outline"
          label="Undo last change"
          disabled={!canUndo}
          onPress={onUndo}
        />

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={onColorPress}
          hitSlop={6}
          pressRetentionOffset={12}
          accessibilityRole="button"
          accessibilityLabel="Change section color"
        >
          <View style={[styles.colorDot, { backgroundColor: color }]} />
        </Pressable>

        <IconButton
          icon="checkmark"
          label="Save section"
          selected
          disabled={shapeCount === 0}
          onPress={onSave}
        />
        <IconButton icon="close" label="Cancel editing" onPress={onCancel} />

        {editing && onDeleteZone ? (
          <>
            <View style={styles.divider} />
            <IconButton
              icon="trash-outline"
              label="Delete section"
              danger
              onPress={onDeleteZone}
            />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    width: 58,
    maxHeight: "100%",
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: "rgba(255, 255, 255, 0.96)",
    ...shadow.sheet,
  },
  tools: {
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  button: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.md,
    backgroundColor: "transparent",
  },
  buttonSelected: {
    backgroundColor: colors.primary,
  },
  buttonDanger: {
    backgroundColor: colors.dangerLight,
  },
  colorDot: {
    width: 25,
    height: 25,
    borderWidth: 2,
    borderColor: colors.surface,
    borderRadius: radius.pill,
  },
  divider: {
    width: 30,
    height: StyleSheet.hairlineWidth,
    marginVertical: 2,
    backgroundColor: colors.border,
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
});
