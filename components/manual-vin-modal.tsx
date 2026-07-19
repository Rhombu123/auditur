import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { KeyboardModalSheet } from "@/components/keyboard-modal-sheet";
import { Button } from "@/components/ui/button";
import { colors, radius, spacing, typography } from "@/constants/theme";
import type { InventoryItem } from "@/lib/types";
import { formatVehicleTitle, getVehicleDisplay } from "@/lib/vehicle-display";

type LookupState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "no-inventory" }
  | { kind: "matched"; item: InventoryItem }
  | { kind: "not-found"; suffix: string }
  | { kind: "error"; message: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  onCheckPriceList: (vinSuffix: string) => Promise<InventoryItem | null | "no-inventory">;
  onSaveScan: (vinSuffix: string) => Promise<void>;
};

function normalizeSuffix(input: string): string | null {
  const suffix = input.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (suffix.length !== 6) return null;
  return suffix;
}

export function ManualVinModal({
  visible,
  onClose,
  onCheckPriceList,
  onSaveScan,
}: Props) {
  const [suffix, setSuffix] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setSuffix("");
      setLookup({ kind: "idle" });
      setSaving(false);
    }
  }, [visible]);

  const normalized = normalizeSuffix(suffix);
  const canSubmit = Boolean(normalized);

  async function handleCheck() {
    if (!normalized) return;
    setLookup({ kind: "loading" });
    try {
      const result = await onCheckPriceList(normalized);
      if (result === "no-inventory") {
        setLookup({ kind: "no-inventory" });
      } else if (result) {
        setLookup({ kind: "matched", item: result });
      } else {
        setLookup({ kind: "not-found", suffix: normalized });
      }
    } catch (error) {
      setLookup({
        kind: "error",
        message: error instanceof Error ? error.message : "Lookup failed.",
      });
    }
  }

  async function handleSaveScan() {
    if (!normalized) return;
    setSaving(true);
    try {
      await onSaveScan(normalized);
      onClose();
    } catch {
      // Parent shows scan modal errors.
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardModalSheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Enter last 6 of VIN</Text>
      <Text style={styles.hint}>
        Use when the barcode or QR won&apos;t scan. Check the uploaded price list or save a scan at your location.
      </Text>

      <TextInput
        style={styles.input}
        value={suffix}
        onChangeText={(value) => {
          setSuffix(value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6));
          setLookup({ kind: "idle" });
        }}
        placeholder="ABC123"
        placeholderTextColor={colors.textMuted}
        keyboardType="default"
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        autoFocus
      />

      {lookup.kind === "loading" ? (
        <ActivityIndicator color={colors.primary} style={styles.lookupLoader} />
      ) : null}

      {lookup.kind === "no-inventory" ? (
        <Text style={styles.lookupWarn}>Upload a price list on the Upload tab first.</Text>
      ) : null}

      {lookup.kind === "matched" ? (
        <View style={styles.lookupCard}>
          <Text style={styles.lookupLabel}>On price list</Text>
          <Text style={styles.lookupVehicle}>
            {formatVehicleTitle(getVehicleDisplay(lookup.item))}
          </Text>
          <Text style={styles.lookupDetail}>{lookup.item.color}</Text>
        </View>
      ) : null}

      {lookup.kind === "not-found" ? (
        <View style={styles.lookupCardMuted}>
          <Text style={styles.lookupLabel}>Not on price list</Text>
          <Text style={styles.lookupDetail}>
            {lookup.suffix} is not on the current upload. You can still save a manual scan.
          </Text>
        </View>
      ) : null}

      {lookup.kind === "error" ? (
        <Text style={styles.lookupError}>{lookup.message}</Text>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="Check price list"
          variant="secondary"
          onPress={() => void handleCheck()}
          disabled={!canSubmit || lookup.kind === "loading" || saving}
          style={styles.actionBtn}
        />
        <Button
          label={saving ? "Saving…" : "Save scan"}
          onPress={() => void handleSaveScan()}
          disabled={!canSubmit || saving || lookup.kind === "loading"}
          loading={saving}
          style={styles.actionBtn}
        />
      </View>

      <Button label="Cancel" variant="secondary" onPress={onClose} />
    </KeyboardModalSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: "900", color: colors.text },
  hint: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  input: {
    marginTop: spacing.lg,
    ...typography.vin,
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 6,
    textAlign: "center",
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
  },
  lookupLoader: { marginTop: spacing.lg },
  lookupCard: {
    marginTop: spacing.lg,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  lookupCardMuted: {
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  lookupLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    color: colors.primaryDark,
  },
  lookupVehicle: {
    marginTop: spacing.xs,
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
  },
  lookupDetail: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  lookupWarn: {
    marginTop: spacing.lg,
    color: colors.warning,
    fontWeight: "600",
    fontSize: 14,
  },
  lookupError: {
    marginTop: spacing.lg,
    color: colors.danger,
    fontSize: 14,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  actionBtn: { flex: 1, borderRadius: radius.md },
});
