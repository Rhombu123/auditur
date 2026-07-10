import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { colors, radius, shadow, spacing } from "@/constants/theme";
import type { ZoneShapeKind } from "@/lib/zone-shapes";

export type ZoneEditorTool = ZoneShapeKind | "highlight" | "eraser" | "move";

type Props = {
  visible: boolean;
  tool: ZoneEditorTool;
  editing: boolean;
  shapeCount: number;
  onSelectTool: (tool: ZoneEditorTool) => void;
  onSave: () => void;
  onCancel: () => void;
  onDeleteZone?: () => void;
};

function toolHint(tool: ZoneEditorTool, editing: boolean): string {
  if (tool === "move") {
    return "Drag the center dot to move a shape. Tap a shape to select it.";
  }
  if (tool === "highlight") {
    return "Tap the map to paint extra coverage onto this section.";
  }
  if (tool === "eraser") {
    return "Tap a highlighted area or shape piece to remove it.";
  }
  if (tool === "oval") {
    return "Tap the map to place an oval. Drag handles to resize, center to move.";
  }
  if (tool === "square") {
    return "Tap the map to place a square. Drag handles to resize, center to move.";
  }
  return "Tap the map to place a rectangle. Drag handles to resize, center to move.";
}

export function MapDrawToolbar({
  visible,
  tool,
  editing,
  shapeCount,
  onSelectTool,
  onSave,
  onCancel,
  onDeleteZone,
}: Props) {
  if (!visible) return null;

  return (
    <View style={styles.toolbar}>
      <Text style={styles.step}>{editing ? "Edit lot section" : "Add lot section"}</Text>
      <Text style={styles.hint}>{toolHint(tool, editing)}</Text>

      <View style={styles.toolRow}>
        <Button
          label="Rect"
          variant={tool === "rectangle" ? "primary" : "secondary"}
          compact
          onPress={() => onSelectTool("rectangle")}
        />
        <Button
          label="Square"
          variant={tool === "square" ? "primary" : "secondary"}
          compact
          onPress={() => onSelectTool("square")}
        />
        <Button
          label="Oval"
          variant={tool === "oval" ? "primary" : "secondary"}
          compact
          onPress={() => onSelectTool("oval")}
        />
      </View>

      <View style={styles.toolRow}>
        <Button
          label="Move"
          variant={tool === "move" ? "primary" : "secondary"}
          compact
          onPress={() => onSelectTool("move")}
        />
        <Button
          label="Highlight"
          variant={tool === "highlight" ? "primary" : "secondary"}
          compact
          onPress={() => onSelectTool("highlight")}
        />
        <Button
          label="Eraser"
          variant={tool === "eraser" ? "primary" : "secondary"}
          compact
          onPress={() => onSelectTool("eraser")}
        />
      </View>

      <View style={styles.actions}>
        <Button
          label={`Save (${shapeCount})`}
          compact
          onPress={onSave}
          disabled={shapeCount === 0}
        />
        {editing && onDeleteZone ? (
          <Button label="Remove zone" variant="danger" compact onPress={onDeleteZone} />
        ) : null}
        <Button label="Cancel" variant="secondary" compact onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sheet,
  },
  step: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primaryDark,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  hint: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  toolRow: {
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    justifyContent: "center",
  },
});
