import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import {
  TurnstileWidget,
  turnstileConfigured,
} from "@/components/turnstile-widget";
import { colors, radius, shadow, spacing } from "@/constants/theme";
import { authStorageUsesMemory } from "@/lib/auth-storage";
import { type AccountType, useAuth } from "@/lib/auth-context";

type Mode = "login" | "signup";

export default function LoginScreen() {
  const { signIn, signUp, resendSignupConfirmation } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);

  async function handleSubmit() {
    setError(null);
    setConfirmationEmail(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!accountType) throw new Error("Choose owner / GM or employee.");
        const result = await signUp(
          email,
          password,
          { fullName, accountType },
          captchaToken ?? undefined,
        );
        if (result === "confirmation-required") {
          setConfirmationEmail(email.trim().toLowerCase());
        }
      } else {
        await signIn(email, password, captchaToken ?? undefined);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setCaptchaToken(null);
      setCaptchaAttempt((value) => value + 1);
      setLoading(false);
    }
  }

  const canSubmit =
    email.includes("@") &&
    (mode === "login" || password.length >= 12) &&
    (__DEV__
      ? !turnstileConfigured || Boolean(captchaToken)
      : turnstileConfigured && Boolean(captchaToken)) &&
    (mode === "login" || (Boolean(fullName.trim()) && accountType !== null));

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Image source={require("../../assets/icon.png")} style={styles.logoImage} />
          </View>
          <Text style={styles.title}>Auditur</Text>
          <Text style={styles.subtitle}>
            {mode === "signup"
              ? "Create your dealership account with an email and password."
              : "Sign in to scan, track, and manage lot inventory."}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.modeTabs}>
            {(["login", "signup"] as const).map((item) => (
              <Pressable
                key={item}
                style={[styles.modeTab, mode === item && styles.modeTabActive]}
                onPress={() => {
                  setMode(item);
                  setError(null);
                }}
              >
                <Text style={[styles.modeTabText, mode === item && styles.modeTabTextActive]}>
                  {item === "login" ? "Sign in" : "Create account"}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === "signup" ? (
            <>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Jordan Lee"
                placeholderTextColor={colors.textMuted}
                textContentType="name"
                autoComplete="name"
              />

              <Text style={styles.label}>Account type</Text>
              <View style={styles.roleRow}>
                {([
                  ["owner_gm", "Owner / GM"],
                  ["employee", "Employee"],
                ] as const).map(([value, label]) => (
                  <Pressable
                    key={value}
                    style={[styles.roleCard, accountType === value && styles.roleCardActive]}
                    onPress={() => setAccountType(value)}
                  >
                    <Text
                      style={[
                        styles.roleCardText,
                        accountType === value && styles.roleCardTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@dealership.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.label}>Password</Text>
              <PasswordInput
                style={styles.passwordText}
                value={password}
                onChangeText={setPassword}
                placeholder={
                  mode === "signup" ? "12+ chars, mixed case, number, symbol" : "Password"
                }
                placeholderTextColor={colors.textMuted}
                textContentType={mode === "signup" ? "newPassword" : "password"}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              <TurnstileWidget key={captchaAttempt} onToken={setCaptchaToken} />

              <Button
                label={
                  loading
                    ? mode === "signup"
                      ? "Creating account…"
                      : "Signing in…"
                    : mode === "signup"
                      ? "Create account"
                      : "Sign in"
                }
                onPress={() => void handleSubmit()}
                loading={loading}
                disabled={!canSubmit}
              />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {confirmationEmail ? (
            <View style={styles.confirmation}>
              <Text style={styles.confirmationTitle}>Check your work email</Text>
              <Text style={styles.confirmationText}>
                Confirm {confirmationEmail}, then return here and sign in to set up
                Microsoft Authenticator.
              </Text>
              <Button
                label="Resend confirmation"
                variant="secondary"
                onPress={() =>
                  void resendSignupConfirmation(confirmationEmail).catch(
                    (resendError) =>
                      setError(
                        resendError instanceof Error
                          ? resendError.message
                          : "Could not resend confirmation.",
                      ),
                  )
                }
              />
            </View>
          ) : null}
        </View>

        {authStorageUsesMemory ? (
          <Text style={styles.devNote}>
            Dev note: rebuild the app once so sign-in persists after you close Auditur.
          </Text>
        ) : null}

        {loading ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: "center",
  },
  hero: { alignItems: "center", marginBottom: spacing.xxl },
  logo: {
    width: 72,
    height: 72,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
    ...shadow.card,
  },
  logoImage: { width: 56, height: 56, borderRadius: radius.lg },
  title: { fontSize: 28, fontWeight: "800", color: colors.text },
  subtitle: {
    marginTop: spacing.sm,
    textAlign: "center",
    color: colors.textSecondary,
    lineHeight: 22,
    fontSize: 15,
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    ...shadow.card,
  },
  modeTabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  modeTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  modeTabActive: { backgroundColor: colors.surface },
  modeTabText: { color: colors.textSecondary, fontWeight: "600", fontSize: 13 },
  modeTabTextActive: { color: colors.text, fontWeight: "700" },
  label: { fontSize: 14, fontWeight: "700", color: colors.text },
  roleRow: { flexDirection: "row", gap: spacing.sm },
  roleCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  roleCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  roleCardText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  roleCardTextActive: { color: colors.primary, fontWeight: "700" },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 17,
    color: colors.text,
  },
  passwordText: { fontSize: 17 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  confirmation: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  confirmationTitle: { color: colors.primaryDark, fontWeight: "800" },
  confirmationText: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  devNote: {
    marginTop: spacing.lg,
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
  spinner: { marginTop: spacing.lg },
});
