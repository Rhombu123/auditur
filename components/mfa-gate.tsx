import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

import { Button } from "@/components/ui/button";
import { colors, radius, shadow, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import {
  generateMfaRecoveryCodes,
  recoverMfaWithCode,
} from "@/lib/mfa-api";
import { useMfa } from "@/lib/mfa-context";
import { supabase } from "@/lib/supabase";

export function MfaGate() {
  const { session, signOut } = useAuth();
  const { status, factorId, error: statusError, refreshMfa } = useMfa();
  const [enrollingFactorId, setEnrollingFactorId] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  useEffect(() => {
    if (status !== "needs-enrollment" || enrollingFactorId) return;
    void (async () => {
      setBusy(true);
      setError(null);
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const factor of factors?.all ?? []) {
        if (factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Microsoft Authenticator",
      });
      if (enrollError) {
        setError(enrollError.message);
      } else {
        setEnrollingFactorId(data.id);
        setSecret(data.totp.secret);
      }
      setBusy(false);
    })();
  }, [enrollingFactorId, status]);

  async function verify() {
    const targetFactorId =
      status === "needs-enrollment" ? enrollingFactorId : factorId;
    if (!targetFactorId || code.trim().length !== 6) return;
    setBusy(true);
    setError(null);
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: targetFactorId });
    if (challengeError) {
      setError(challengeError.message);
      setBusy(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: targetFactorId,
      challengeId: challenge.id,
      code: code.trim(),
    });
    if (verifyError) {
      setError("That code was not accepted. Wait for a new code and try again.");
    } else {
      setCode("");
      if (status === "needs-enrollment") {
        try {
          setRecoveryCodes(await generateMfaRecoveryCodes());
        } catch (recoveryError) {
          setError(
            recoveryError instanceof Error
              ? recoveryError.message
              : "Could not generate recovery codes.",
          );
        }
      } else {
        await refreshMfa();
      }
    }
    setBusy(false);
  }

  async function recover() {
    setBusy(true);
    setError(null);
    try {
      await recoverMfaWithCode(recoveryCode);
      await signOut();
    } catch (recoveryError) {
      setError(
        recoveryError instanceof Error
          ? recoveryError.message
          : "Could not recover MFA.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
        <Text style={styles.loadingText}>Verifying account security…</Text>
      </View>
    );
  }

  const enrolling = status === "needs-enrollment";
  const otpUri = secret
    ? `otpauth://totp/Auditur:${encodeURIComponent(session?.user.email ?? "account")}?secret=${encodeURIComponent(secret)}&issuer=Auditur&digits=6&period=30`
    : null;

  if (recoveryCodes) {
    return (
      <View style={styles.safe}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.icon}>
            <Ionicons name="key-outline" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Save your recovery codes</Text>
          <Text style={styles.copy}>
            Store these somewhere safe. Each code works once if you lose Microsoft
            Authenticator.
          </Text>
          <View style={styles.recoveryCard}>
            {recoveryCodes.map((recoveryValue) => (
              <Text selectable style={styles.recoveryValue} key={recoveryValue}>
                {recoveryValue}
              </Text>
            ))}
          </View>
          <Button
            label="Copy all codes"
            variant="secondary"
            onPress={() => void Clipboard.setStringAsync(recoveryCodes.join("\n"))}
          />
          <Button
            label="I saved these codes"
            onPress={() => {
              setRecoveryCodes(null);
              void refreshMfa();
            }}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.safe}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.icon}>
          <Ionicons name="shield-checkmark" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>
          {enrolling ? "Secure your account" : "Authenticator code"}
        </Text>
        <Text style={styles.copy}>
          {enrolling
            ? "Open Microsoft Authenticator, add an account, and scan this QR code."
            : "Enter the current six-digit code from Microsoft Authenticator."}
        </Text>

        {enrolling && otpUri ? (
          <View style={styles.qrCard}>
            <QRCode value={otpUri} size={190} backgroundColor={colors.surface} />
            <Text style={styles.secretLabel}>
              {"Can't scan? Enter this setup key:"}
            </Text>
            <Text selectable style={styles.secret}>{secret}</Text>
          </View>
        ) : null}

        {recoveryMode ? (
          <TextInput
            style={styles.recoveryInput}
            value={recoveryCode}
            onChangeText={setRecoveryCode}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="XXXX-XXXX-XXXX"
            placeholderTextColor={colors.textMuted}
          />
        ) : (
          <TextInput
            style={styles.codeInput}
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            placeholder="000000"
            placeholderTextColor={colors.textMuted}
            maxLength={6}
          />
        )}
        {error || statusError ? (
          <Text style={styles.error}>{error ?? statusError}</Text>
        ) : null}
        <View style={styles.actions}>
          {recoveryMode ? (
            <Button
              label="Continue with recovery code"
              onPress={() => void recover()}
              loading={busy}
              disabled={recoveryCode.replace(/[^A-Z0-9]/gi, "").length !== 12}
              style={styles.actionButton}
            />
          ) : (
            <Button
              label={enrolling ? "Enable authenticator" : "Verify code"}
              onPress={() => void verify()}
              loading={busy}
              disabled={(!factorId && !enrollingFactorId) || code.length !== 6}
              style={styles.actionButton}
            />
          )}
          {!enrolling ? (
            <Button
              label={recoveryMode ? "Use authenticator instead" : "Use a recovery code"}
              variant="secondary"
              onPress={() => setRecoveryMode((value) => !value)}
              style={styles.actionButton}
            />
          ) : null}
          <Button
            label="Sign out"
            variant="ghost"
            onPress={() => void signOut()}
            style={styles.signOutButton}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  loadingText: { color: colors.textSecondary, fontWeight: "600" },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  title: {
    marginTop: spacing.lg,
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
  copy: {
    maxWidth: 330,
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  qrCard: {
    marginTop: spacing.xl,
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  secretLabel: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 12,
  },
  secret: {
    maxWidth: 260,
    marginTop: spacing.xs,
    color: colors.text,
    fontFamily: "Menlo",
    fontSize: 12,
    textAlign: "center",
  },
  codeInput: {
    width: 210,
    minHeight: 58,
    marginTop: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: "Menlo",
    fontSize: 28,
    letterSpacing: 10,
    textAlign: "center",
  },
  error: {
    maxWidth: 320,
    marginVertical: spacing.md,
    color: colors.danger,
    textAlign: "center",
  },
  actions: {
    width: "100%",
    maxWidth: 300,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  actionButton: {
    width: "100%",
  },
  signOutButton: {
    width: 130,
    alignSelf: "center",
    marginTop: spacing.xs,
    borderColor: "transparent",
  },
  recoveryCard: {
    width: "100%",
    marginVertical: spacing.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recoveryValue: {
    color: colors.text,
    fontFamily: "Menlo",
    fontSize: 16,
    textAlign: "center",
    letterSpacing: 1,
  },
  recoveryInput: {
    width: 250,
    minHeight: 54,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    color: colors.text,
    fontFamily: "Menlo",
    fontSize: 18,
    textAlign: "center",
  },
});
