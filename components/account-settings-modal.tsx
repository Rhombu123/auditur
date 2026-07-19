import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { KeyboardModalSheet } from "@/components/keyboard-modal-sheet";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { colors, radius, spacing } from "@/constants/theme";
import { formatAuthError, normalizeEmail } from "@/lib/email-auth";
import { getErrorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import { updateDealershipName } from "@/lib/team-api";

export type AccountSettingMode = "email" | "password" | "dealership";

type Props = {
  mode: AccountSettingMode | null;
  currentEmail: string;
  currentDealershipName: string;
  dealershipId: string | null;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
};

const COPY: Record<
  AccountSettingMode,
  { title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  email: {
    title: "Change email",
    subtitle: "Use a new email address the next time you sign in.",
    icon: "mail",
  },
  password: {
    title: "Change password",
    subtitle: "Confirm your current password, then choose a new secure password.",
    icon: "key",
  },
  dealership: {
    title: "Edit dealership",
    subtitle: "Update the dealership name shown to your team.",
    icon: "business",
  },
};

export function AccountSettingsModal({
  mode,
  currentEmail,
  currentDealershipName,
  dealershipId,
  onClose,
  onUpdated,
}: Props) {
  const [value, setValue] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mode) return;
    setValue(
      mode === "email"
        ? currentEmail
        : mode === "dealership"
          ? currentDealershipName
          : "",
    );
    setCurrentPassword("");
    setConfirmPassword("");
    setError(null);
  }, [currentDealershipName, currentEmail, mode]);

  if (!mode) return null;
  const copy = COPY[mode];

  async function save() {
    const trimmed = value.trim();
    let normalizedEmail = trimmed;
    if (mode === "email") {
      try {
        normalizedEmail = normalizeEmail(trimmed);
      } catch (emailError) {
        setError(getErrorMessage(emailError, "Enter a valid email address."));
        return;
      }
    }
    if (mode === "password") {
      if (!currentPassword) {
        setError("Enter your current password.");
        return;
      }
      if (
        trimmed.length < 12 ||
        !/[a-z]/.test(trimmed) ||
        !/[A-Z]/.test(trimmed) ||
        !/\d/.test(trimmed) ||
        !/[^A-Za-z0-9]/.test(trimmed)
      ) {
        setError(
          "Use at least 12 characters with uppercase, lowercase, a number, and a symbol.",
        );
        return;
      }
      if (trimmed !== confirmPassword) {
        setError("The new passwords do not match.");
        return;
      }
      if (trimmed === currentPassword) {
        setError("Choose a new password that is different from your current password.");
        return;
      }
    }
    if (mode === "dealership" && !trimmed) {
      setError("Enter a dealership name.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (mode === "email") {
        const { error: updateError } = await supabase.auth.updateUser({
          email: normalizedEmail,
        }, {
          emailRedirectTo: "https://auditur.vercel.app/login",
        });
        if (updateError) throw updateError;
        Alert.alert(
          "Check your email",
          "Confirm the email-change message before signing in with the new address.",
        );
      } else if (mode === "password") {
        const { data: currentUserData, error: currentUserError } =
          await supabase.auth.getUser();
        if (currentUserError || !currentUserData.user) {
          throw currentUserError ?? new Error("Your session has expired.");
        }
        const { data: signInData, error: signInError } =
          await supabase.auth.signInWithPassword({
            email: normalizeEmail(currentEmail),
            password: currentPassword,
          });
        if (signInError) {
          throw new Error("Your current password is incorrect.");
        }
        if (signInData.user?.id !== currentUserData.user.id) {
          throw new Error("Could not verify the current account.");
        }
        const { error: updateError } = await supabase.auth.updateUser({
          password: trimmed,
        });
        if (updateError) throw updateError;
        Alert.alert("Password changed", "Your new password is ready to use.");
      } else {
        if (!dealershipId) throw new Error("No active dealership is selected.");
        await updateDealershipName(dealershipId, trimmed);
      }
      await onUpdated();
      onClose();
    } catch (saveError) {
      setError(
        mode === "dealership"
          ? getErrorMessage(saveError, "Could not update this setting.")
          : formatAuthError(saveError, "Could not update this setting."),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardModalSheet visible centered onClose={onClose}>
      <View style={styles.heading}>
        <View style={styles.icon}>
          <Ionicons name={copy.icon} size={23} color={colors.onPrimary} />
        </View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>
      </View>

      {mode === "password" ? (
        <>
          <Text style={styles.label}>Current password</Text>
          <PasswordInput
            value={currentPassword}
            onChangeText={setCurrentPassword}
            textContentType="password"
            autoComplete="current-password"
            placeholder="Current password"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>New password</Text>
          <PasswordInput
            value={value}
            onChangeText={setValue}
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder="New password"
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Confirm new password</Text>
          <PasswordInput
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            textContentType="newPassword"
            autoComplete="new-password"
            placeholder="Confirm new password"
            placeholderTextColor={colors.textMuted}
          />
        </>
      ) : (
        <>
          <Text style={styles.label}>
            {mode === "email" ? "New email address" : "Dealership name"}
          </Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            autoCapitalize={mode === "email" ? "none" : "words"}
            autoCorrect={mode !== "email"}
            keyboardType={mode === "email" ? "email-address" : "default"}
          />
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.actions}>
        <Button
          label="Cancel"
          variant="secondary"
          onPress={onClose}
          style={styles.action}
        />
        <Button
          label={saving ? "Saving…" : "Save"}
          loading={saving}
          disabled={saving}
          onPress={() => void save()}
          style={styles.action}
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
    marginBottom: spacing.md,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  headingCopy: { flex: 1 },
  title: { color: colors.text, fontSize: 22, fontWeight: "900" },
  subtitle: {
    marginTop: 3,
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  label: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    minHeight: 50,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 15,
  },
  error: { marginTop: spacing.md, color: colors.danger, fontSize: 13 },
  actions: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    flexDirection: "row",
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  action: { flex: 1 },
});
