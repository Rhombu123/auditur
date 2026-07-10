import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { colors, radius, shadow, spacing } from "@/constants/theme";
import { authStorageUsesMemory } from "@/lib/auth-storage";
import { useAuth } from "@/lib/auth-context";

type Step = "email" | "code";

export default function LoginScreen() {
  const { sendEmailCode, verifyEmailCode } = useAuth();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSendCode() {
    setError(null);
    setLoading(true);
    try {
      await sendEmailCode(email);
      setStep("code");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setError(null);
    setLoading(true);
    try {
      await verifyEmailCode(email, code);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>A</Text>
          </View>
          <Text style={styles.title}>Auditur</Text>
          <Text style={styles.subtitle}>
            Sign in with your email to scan, track, and manage lot inventory.
          </Text>
        </View>

        <View style={styles.card}>
          {step === "email" ? (
            <>
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
              <Button
                label={loading ? "Sending…" : "Send code"}
                onPress={() => void handleSendCode()}
                loading={loading}
                disabled={!email.includes("@")}
              />
            </>
          ) : (
            <>
              <Text style={styles.label}>Verification code</Text>
              <Text style={styles.hint}>
                We emailed a 6-digit code to {email.trim().toLowerCase()} — not a sign-in link.
              </Text>
              <TextInput
                style={[styles.input, styles.codeInput]}
                value={code}
                onChangeText={setCode}
                placeholder="000000"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
                maxLength={6}
              />
              <Button
                label={loading ? "Verifying…" : "Sign in"}
                onPress={() => void handleVerify()}
                loading={loading}
                disabled={code.replace(/\D/g, "").length < 6}
              />
              <Pressable
                style={styles.linkBtn}
                onPress={() => {
                  void handleSendCode();
                }}
                disabled={loading}
              >
                <Text style={styles.linkText}>Resend code</Text>
              </Pressable>
              <Pressable
                style={styles.linkBtn}
                onPress={() => {
                  setStep("email");
                  setCode("");
                  setError(null);
                }}
              >
                <Text style={styles.linkText}>Use a different email</Text>
              </Pressable>
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}
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
  logoText: { color: colors.onPrimary, fontSize: 34, fontWeight: "800" },
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
  label: { fontSize: 14, fontWeight: "700", color: colors.text },
  hint: { color: colors.textSecondary, fontSize: 13, marginTop: -spacing.xs },
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
  codeInput: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 8,
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
  linkBtn: { alignItems: "center", paddingVertical: spacing.sm },
  linkText: { color: colors.primary, fontWeight: "600", fontSize: 14 },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20 },
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
