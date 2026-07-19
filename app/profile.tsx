import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AccountSettingsModal,
  type AccountSettingMode,
} from "@/components/account-settings-modal";
import { colors, radius, shadow, spacing } from "@/constants/theme";
import { deleteCurrentAccount } from "@/lib/account-api";
import { useAuth } from "@/lib/auth-context";
import { useDealership } from "@/lib/dealership-context";
import {
  getScanSuccessHapticsEnabled,
  setScanSuccessHapticsEnabled,
} from "@/lib/haptic-preferences";
import { useLiveMultiUserProgress } from "@/lib/live-progress";
import { supabase } from "@/lib/supabase";

type Profile = {
  fullName: string;
  email: string;
  accountType: "owner_gm" | "employee";
  auditurId: string | null;
  dealershipName: string | null;
};

function DetailRow({
  label,
  value,
  mono = false,
  action,
}: {
  label: string;
  value: string;
  mono?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailText}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={[styles.detailValue, mono && styles.mono]}>{value}</Text>
      </View>
      {action}
    </View>
  );
}

function SettingRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.settingRow} onPress={onPress}>
      <View style={styles.settingIcon}>
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <View style={styles.detailText}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingSubtitle}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const { activeDealership, hasPermission, refreshAccess } = useDealership();
  const user = session?.user;
  const metadata = user?.user_metadata ?? {};
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [settingMode, setSettingMode] = useState<AccountSettingMode | null>(null);
  const [scanHapticsEnabled, setScanHapticsEnabled] = useState(true);
  const [savingLiveProgress, setSavingLiveProgress] = useState(false);
  const {
    enabled: liveProgressEnabled,
    loading: liveProgressLoading,
    updateEnabled: updateLiveProgressEnabled,
  } = useLiveMultiUserProgress();
  const [profile, setProfile] = useState<Profile>({
    fullName:
      typeof metadata.full_name === "string"
        ? metadata.full_name
        : user?.email?.split("@")[0] ?? "Member",
    email: user?.email ?? "—",
    accountType: metadata.account_type === "employee" ? "employee" : "owner_gm",
    auditurId: typeof metadata.auditur_id === "string" ? metadata.auditur_id : null,
    dealershipName:
      typeof metadata.dealership_name === "string" ? metadata.dealership_name : null,
  });

  useEffect(() => {
    void getScanSuccessHapticsEnabled().then(setScanHapticsEnabled);
  }, []);

  useEffect(() => {
    if (!user) return;
    void supabase
      .from("profiles")
      .select("full_name, account_type, auditur_id, dealership_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setProfile({
          fullName: data.full_name,
          email: user.email ?? "—",
          accountType: data.account_type,
          auditurId: data.auditur_id,
          dealershipName: data.dealership_name,
        });
      });
  }, [user]);

  const initial = profile.fullName.slice(0, 1).toUpperCase() || "A";
  const canManageDealership =
    activeDealership?.membershipKind === "owner" ||
    hasPermission("manage_dealership");

  function confirmSignOut() {
    Alert.alert("Sign out", "Sign out of Auditur on this device?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: () => {
          void signOut();
        },
      },
    ]);
  }

  function confirmDeleteAccount() {
    Alert.alert(
      "Permanently delete account?",
      "Your sign-in, profile, team membership, and recovery codes will be deleted. Dealership business records are retained without your personal identity.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete account",
          style: "destructive",
          onPress: () => {
            setDeletingAccount(true);
            void deleteCurrentAccount()
              .then(async () => {
                await signOut().catch(() => undefined);
                router.replace("/(auth)/login");
              })
              .catch((deleteError) => {
                setDeletingAccount(false);
                Alert.alert(
                  "Account not deleted",
                  deleteError instanceof Error
                    ? deleteError.message
                    : "The account could not be deleted.",
                );
              });
          },
        },
      ],
    );
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/(tabs)");
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={goBack}
          accessibilityLabel="Go back"
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerButton} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.name}>{profile.fullName}</Text>
          <Text style={styles.role}>
            {profile.accountType === "employee" ? "Dealership employee" : "Owner / GM"}
          </Text>
        </View>

        <View style={styles.card}>
          <DetailRow label="Email" value={profile.email} />
          <View style={styles.divider} />
          <DetailRow
            label="Dealership"
            value={activeDealership?.dealershipName || "Not assigned yet"}
          />
          <View style={styles.divider} />
          <DetailRow
            label="Auditur ID"
            value={profile.auditurId ?? "Not assigned"}
            mono
            action={
              profile.auditurId ? (
                <Pressable
                  style={styles.copyButton}
                  onPress={() => {
                    void Clipboard.setStringAsync(profile.auditurId!);
                  }}
                  accessibilityLabel="Copy Auditur ID"
                >
                  <Ionicons name="copy-outline" size={17} color={colors.primary} />
                </Pressable>
              ) : null
            }
          />
        </View>

        <Text style={styles.sectionLabel}>Account settings</Text>
        <View style={styles.settingsCard}>
          <SettingRow
            icon="mail-outline"
            title="Change email"
            subtitle={profile.email}
            onPress={() => setSettingMode("email")}
          />
          <View style={styles.divider} />
          <SettingRow
            icon="key-outline"
            title="Change password"
            subtitle="Update your sign-in password"
            onPress={() => setSettingMode("password")}
          />
          <View style={styles.divider} />
          <View style={styles.settingRow}>
            <View style={styles.settingIcon}>
              <Ionicons name="phone-portrait-outline" size={19} color={colors.primary} />
            </View>
            <View style={styles.detailText}>
              <Text style={styles.settingTitle}>Scan success haptic</Text>
              <Text style={styles.settingSubtitle}>
                Pulse after a vehicle scan is saved
              </Text>
            </View>
            <Switch
              value={scanHapticsEnabled}
              onValueChange={(enabled) => {
                setScanHapticsEnabled(enabled);
                void setScanSuccessHapticsEnabled(enabled).catch(() => {
                  setScanHapticsEnabled(!enabled);
                  Alert.alert("Setting not saved", "Try changing the setting again.");
                });
              }}
              trackColor={{ false: colors.borderStrong, true: colors.primaryBorder }}
              thumbColor={scanHapticsEnabled ? colors.primary : colors.surface}
              accessibilityLabel="Scan success haptic"
            />
          </View>
          {activeDealership && canManageDealership ? (
            <>
              <View style={styles.divider} />
              <View style={styles.settingRow}>
                <View style={styles.settingIcon}>
                  <Ionicons name="people-circle-outline" size={19} color={colors.primary} />
                </View>
                <View style={styles.detailText}>
                  <Text style={styles.settingTitle}>Live multi-user progress</Text>
                  <Text style={styles.settingSubtitle}>
                    Update audit totals as teammates scan
                  </Text>
                </View>
                <Switch
                  value={liveProgressEnabled}
                  disabled={liveProgressLoading || savingLiveProgress}
                  onValueChange={(enabled) => {
                    setSavingLiveProgress(true);
                    void updateLiveProgressEnabled(enabled)
                      .catch((settingError) => {
                        Alert.alert(
                          "Setting not saved",
                          settingError instanceof Error
                            ? settingError.message
                            : "Try changing the setting again.",
                        );
                      })
                      .finally(() => setSavingLiveProgress(false));
                  }}
                  trackColor={{ false: colors.borderStrong, true: colors.primaryBorder }}
                  thumbColor={liveProgressEnabled ? colors.primary : colors.surface}
                  accessibilityLabel="Live multi-user progress"
                />
              </View>
              <View style={styles.divider} />
              <SettingRow
                icon="business-outline"
                title="Edit dealership name"
                subtitle={activeDealership.dealershipName}
                onPress={() => setSettingMode("dealership")}
              />
            </>
          ) : null}
        </View>

        <Pressable style={styles.teamButton} onPress={() => router.push("/team")}>
          <View style={styles.teamIcon}>
            <Ionicons name="people-outline" size={20} color={colors.primary} />
          </View>
          <View style={styles.detailText}>
            <Text style={styles.teamTitle}>Team & access</Text>
            <Text style={styles.teamSubtitle}>
              {activeDealership
                ? `${activeDealership.dealershipName} · ${
                    activeDealership.membershipKind === "owner"
                      ? "Owner / GM"
                      : activeDealership.roleName ?? "No role"
                  }`
                : "Create or join a dealership"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
        </Pressable>

        <Text style={styles.idHint}>
          {profile.accountType === "employee"
            ? "Share your Auditur ID with your owner or GM to join their dealership team."
            : "Use Team & access to add employees by their Auditur ID and assign roles."}
        </Text>

        <Pressable style={styles.signOutButton} onPress={confirmSignOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
        <Pressable
          style={[styles.deleteAccountButton, deletingAccount && styles.disabled]}
          onPress={confirmDeleteAccount}
          disabled={deletingAccount}
        >
          <Text style={styles.deleteAccountText}>
            {deletingAccount ? "Deleting account…" : "Delete account permanently"}
          </Text>
        </Pressable>
        <Text style={styles.deleteAccountHint}>
          Dealership owners must transfer ownership before deleting their account.
        </Text>
      </ScrollView>

      <AccountSettingsModal
        mode={settingMode}
        currentEmail={profile.email === "—" ? "" : profile.email}
        currentDealershipName={activeDealership?.dealershipName ?? ""}
        dealershipId={activeDealership?.dealershipId ?? null}
        onClose={() => setSettingMode(null)}
        onUpdated={async () => {
          await refreshAccess();
          const { data } = await supabase.auth.getUser();
          if (data.user?.email) {
            setProfile((current) => ({ ...current, email: data.user!.email! }));
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  header: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl },
  identity: { alignItems: "center", paddingVertical: spacing.xl },
  avatar: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
    ...shadow.card,
  },
  avatarText: { color: colors.onPrimary, fontSize: 28, fontWeight: "800" },
  name: { marginTop: spacing.md, color: colors.text, fontSize: 22, fontWeight: "800" },
  role: { marginTop: spacing.xs, color: colors.textSecondary, fontSize: 14 },
  card: {
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  detailRow: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  detailText: { flex: 1 },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  detailValue: { marginTop: 4, color: colors.text, fontSize: 15, fontWeight: "600" },
  mono: { letterSpacing: 1.1, fontVariant: ["tabular-nums"] },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  sectionLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  settingsCard: {
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  settingRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  settingIcon: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryLight,
  },
  settingTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  settingSubtitle: {
    marginTop: 2,
    color: colors.textSecondary,
    fontSize: 12,
  },
  copyButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  idHint: {
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  teamButton: {
    minHeight: 72,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  teamIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primaryLight,
  },
  teamTitle: { color: colors.text, fontSize: 15, fontWeight: "700" },
  teamSubtitle: { marginTop: 3, color: colors.textMuted, fontSize: 12 },
  signOutButton: {
    minHeight: 52,
    marginTop: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
  },
  signOutText: { color: colors.danger, fontSize: 15, fontWeight: "700" },
  deleteAccountButton: {
    minHeight: 44,
    marginTop: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteAccountText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
  deleteAccountHint: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    color: colors.textMuted,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
  },
  disabled: { opacity: 0.5 },
});
