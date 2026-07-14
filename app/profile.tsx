import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, radius, shadow, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
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

export default function ProfileScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const user = session?.user;
  const metadata = user?.user_metadata ?? {};
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
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
            value={profile.dealershipName || "Not added yet"}
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

        <Text style={styles.idHint}>
          Share your Auditur ID with your owner or GM to join their dealership team.
        </Text>

        <Pressable style={styles.signOutButton} onPress={confirmSignOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </ScrollView>
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
});
