import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { KeyboardModalSheet } from "@/components/keyboard-modal-sheet";
import { Button } from "@/components/ui/button";
import { colors, radius, shadow, spacing } from "@/constants/theme";
import { useAuth } from "@/lib/auth-context";
import { useDealership } from "@/lib/dealership-context";
import { getErrorMessage } from "@/lib/errors";
import { adminResetMemberMfa } from "@/lib/mfa-api";
import type { TeamMember, TeamRole } from "@/lib/dealership-types";
import {
  DEALERSHIP_PERMISSIONS,
  type PermissionId,
} from "@/lib/permissions";
import {
  addTeamMember,
  assignTeamMemberRole,
  createTeamRole,
  deleteTeamRole,
  listTeamMembers,
  listTeamRoles,
  removeTeamMember,
  transferDealershipOwnership,
  updateTeamRole,
} from "@/lib/team-api";

export default function TeamScreen() {
  const router = useRouter();
  const { session, signOut } = useAuth();
  const {
    activeDealership,
    dealerships,
    status: dealershipStatus,
    error: accessError,
    hasPermission,
    refreshAccess,
    createDealership,
    switchDealership,
  } = useDealership();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [auditurId, setAuditurId] = useState("");
  const [addRoleId, setAddRoleId] = useState<string | null>(null);
  const [roleEditorVisible, setRoleEditorVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<TeamRole | null>(null);
  const [roleName, setRoleName] = useState("");
  const [rolePermissions, setRolePermissions] = useState<PermissionId[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealershipName, setDealershipName] = useState("");

  const canManageMembers = hasPermission("manage_members");
  const canManageRoles = hasPermission("manage_roles");
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);

  const reload = useCallback(async () => {
    if (!activeDealership) return;
    try {
      setError(null);
      const [nextMembers, nextRoles] = await Promise.all([
        listTeamMembers(activeDealership.dealershipId),
        listTeamRoles(activeDealership.dealershipId),
      ]);
      setMembers(nextMembers);
      setRoles(nextRoles);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not load team."));
    }
  }, [activeDealership]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await Promise.all([reload(), refreshAccess()]);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Team update failed.");
    } finally {
      setBusy(false);
    }
  }

  function openRoleEditor(role?: TeamRole) {
    setEditingRole(role ?? null);
    setRoleName(role?.name ?? "");
    setRolePermissions(role?.permissions ?? ["view_dashboard", "view_audit"]);
    setRoleEditorVisible(true);
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/profile");
  }

  if (!activeDealership) {
    const isOwner = session?.user.user_metadata?.account_type === "owner_gm";
    return (
      <SafeAreaView style={styles.safe}>
        <Header />
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={42} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No dealership team yet</Text>
          <Text style={styles.emptyText}>
            {dealershipStatus === "error"
              ? accessError ?? "Could not load dealership access."
              : isOwner
              ? "Create your dealership to start adding employees and assigning roles."
              : "Share your Auditur ID with an owner or GM, then tap back and reopen this screen."}
          </Text>
          {dealershipStatus === "error" ? (
            <View style={styles.setupForm}>
              <Button label="Retry" onPress={() => void refreshAccess()} />
              <Button
                label="Sign out"
                variant="ghost"
                onPress={() => void signOut()}
              />
            </View>
          ) : isOwner ? (
            <View style={styles.setupForm}>
              <TextInput
                style={styles.input}
                placeholder="Dealership name"
                placeholderTextColor={colors.textMuted}
                value={dealershipName}
                onChangeText={setDealershipName}
              />
              <Button
                label="Create dealership"
                disabled={!dealershipName.trim()}
                loading={busy}
                onPress={() =>
                  void run(() => createDealership(dealershipName))
                }
              />
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <Header onBack={goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary}>
          <View>
            <Text style={styles.eyebrow}>Active dealership</Text>
            <Text style={styles.summaryTitle}>{activeDealership.dealershipName}</Text>
            <Text style={styles.summaryMeta}>
              {activeDealership.membershipKind === "owner"
                ? "Owner / GM"
                : activeDealership.roleName ?? "No role assigned"}
            </Text>
          </View>
          <View style={styles.countBadge}>
            <Text style={styles.countValue}>{members.length}</Text>
            <Text style={styles.countLabel}>Members</Text>
          </View>
        </View>

        {dealerships.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chips}>
              {dealerships.map((dealership) => (
                <ChoiceChip
                  key={dealership.dealershipId}
                  label={dealership.dealershipName}
                  selected={dealership.dealershipId === activeDealership.dealershipId}
                  onPress={() => void switchDealership(dealership.dealershipId)}
                />
              ))}
            </View>
          </ScrollView>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {canManageMembers ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add employee by ID</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              maxLength={9}
              placeholder="9-digit Auditur ID"
              placeholderTextColor={colors.textMuted}
              value={auditurId}
              onChangeText={(value) => setAuditurId(value.replace(/\D/g, "").slice(0, 9))}
            />
            <Text style={styles.fieldLabel}>Role</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chips}>
                <ChoiceChip
                  label="No role"
                  selected={!addRoleId}
                  onPress={() => setAddRoleId(null)}
                />
                {roles.map((role) => (
                  <ChoiceChip
                    key={role.id}
                    label={role.name}
                    selected={addRoleId === role.id}
                    onPress={() => setAddRoleId(role.id)}
                  />
                ))}
              </View>
            </ScrollView>
            <Button
              label="Add employee"
              disabled={auditurId.length !== 9}
              loading={busy}
              onPress={() =>
                void run(async () => {
                  await addTeamMember(
                    activeDealership.dealershipId,
                    auditurId,
                    addRoleId,
                  );
                  setAuditurId("");
                  setAddRoleId(null);
                })
              }
            />
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Members</Text>
        </View>
        <View style={styles.card}>
          {members.map((member, index) => (
            <View key={member.userId}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <View style={styles.memberRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{member.fullName.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{member.fullName}</Text>
                  <Text style={styles.memberMeta}>
                    ID {member.auditurId} · {member.membershipKind === "owner"
                      ? "Owner / GM"
                      : roleById.get(member.roleId ?? "")?.name ?? "No role"}
                  </Text>
                </View>
                {canManageMembers && member.membershipKind !== "owner" ? (
                  <Pressable
                    style={styles.moreButton}
                    onPress={() =>
                      Alert.alert(member.fullName, "Manage this team member", [
                        ...roles.map((role) => ({
                          text: `Assign ${role.name}`,
                          onPress: () =>
                            void run(() =>
                              assignTeamMemberRole(
                                activeDealership.dealershipId,
                                member.userId,
                                role.id,
                              ),
                            ),
                        })),
                        ...(activeDealership.membershipKind === "owner"
                          ? [
                              {
                                text: "Transfer dealership ownership",
                                style: "destructive" as const,
                                onPress: () =>
                                  Alert.alert(
                                    "Transfer ownership?",
                                    `${member.fullName} will become the dealership owner. You will lose owner access immediately.`,
                                    [
                                      { text: "Cancel", style: "cancel" },
                                      {
                                        text: "Transfer ownership",
                                        style: "destructive",
                                        onPress: () =>
                                          void run(() =>
                                            transferDealershipOwnership(
                                              activeDealership.dealershipId,
                                              member.userId,
                                            ),
                                          ),
                                      },
                                    ],
                                  ),
                              },
                            ]
                          : []),
                        {
                          text: "Reset MFA",
                          onPress: () =>
                            Alert.alert(
                              "Reset member MFA?",
                              "Their sessions will be revoked and they must enroll again.",
                              [
                                { text: "Cancel", style: "cancel" },
                                {
                                  text: "Reset MFA",
                                  style: "destructive",
                                  onPress: () =>
                                    void run(() => adminResetMemberMfa(member.userId)),
                                },
                              ],
                            ),
                        },
                        {
                          text: "Remove from team",
                          style: "destructive" as const,
                          onPress: () =>
                            void run(() =>
                              removeTeamMember(
                                activeDealership.dealershipId,
                                member.userId,
                              ),
                            ),
                        },
                        { text: "Cancel", style: "cancel" as const },
                      ])
                    }
                  >
                    <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
          {members.length === 0 ? (
            <Text style={styles.emptyText}>No team members have been added yet.</Text>
          ) : null}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Roles</Text>
          {canManageRoles ? (
            <Pressable onPress={() => openRoleEditor()}>
              <Text style={styles.link}>Create role</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.card}>
          {roles.map((role, index) => (
            <View key={role.id}>
              {index > 0 ? <View style={styles.divider} /> : null}
              <Pressable
                style={styles.roleRow}
                disabled={!canManageRoles}
                onPress={() => openRoleEditor(role)}
              >
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>{role.name}</Text>
                  <Text style={styles.memberMeta}>
                    {role.permissions.length} permissions ·{" "}
                    {members.filter((member) => member.roleId === role.id).length} members
                  </Text>
                </View>
                {canManageRoles ? (
                  <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
                ) : null}
              </Pressable>
            </View>
          ))}
          {roles.length === 0 ? <Text style={styles.emptyText}>No custom roles yet.</Text> : null}
        </View>
      </ScrollView>

      <KeyboardModalSheet
        visible={roleEditorVisible}
        onClose={() => setRoleEditorVisible(false)}
      >
        <Text style={styles.sheetTitle}>{editingRole ? "Edit role" : "Create role"}</Text>
        <TextInput
          style={styles.input}
          placeholder="Role name"
          placeholderTextColor={colors.textMuted}
          value={roleName}
          onChangeText={setRoleName}
        />
        <View style={styles.permissionList}>
          {DEALERSHIP_PERMISSIONS.filter(
            (permission) => permission.id !== "manage_dealership",
          ).map((permission) => {
            const selected = rolePermissions.includes(permission.id);
            return (
              <Pressable
                key={permission.id}
                style={styles.permissionRow}
                onPress={() =>
                  setRolePermissions((current) =>
                    selected
                      ? current.filter((item) => item !== permission.id)
                      : [...current, permission.id],
                  )
                }
              >
                <Ionicons
                  name={selected ? "checkbox" : "square-outline"}
                  size={22}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text style={styles.permissionLabel}>{permission.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Button
          label={editingRole ? "Save role" : "Create role"}
          disabled={!roleName.trim()}
          loading={busy}
          onPress={() =>
            void run(async () => {
              if (editingRole) {
                await updateTeamRole(
                  activeDealership.dealershipId,
                  editingRole.id,
                  roleName,
                  rolePermissions,
                );
              } else {
                await createTeamRole(
                  activeDealership.dealershipId,
                  roleName,
                  rolePermissions,
                );
              }
              setRoleEditorVisible(false);
            })
          }
        />
        {editingRole ? (
          <Button
            label="Delete role"
            variant="danger"
            style={styles.deleteRoleButton}
            onPress={() =>
              Alert.alert("Delete role?", "Members assigned to it will have no role.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () =>
                    void run(async () => {
                      await deleteTeamRole(
                        activeDealership.dealershipId,
                        editingRole.id,
                      );
                      setRoleEditorVisible(false);
                    }),
                },
              ])
            }
          />
        ) : null}
      </KeyboardModalSheet>
    </SafeAreaView>
  );
}

function Header({ onBack }: { onBack?: () => void }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          style={styles.headerButton}
          onPress={onBack}
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      ) : (
        <View style={styles.headerButton} />
      )}
      <Text style={styles.headerTitle}>Team & access</Text>
      <View style={styles.headerButton} />
    </View>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={[styles.chip, selected && styles.chipSelected]} onPress={onPress}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
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
  headerButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { color: colors.text, fontSize: 17, fontWeight: "700" },
  content: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.md },
  summary: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.primary,
    ...shadow.card,
  },
  eyebrow: { color: colors.primaryLight, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  summaryTitle: { marginTop: 4, color: colors.onPrimary, fontSize: 20, fontWeight: "800" },
  summaryMeta: { marginTop: 4, color: colors.primaryLight, fontSize: 13 },
  countBadge: { alignItems: "center", paddingHorizontal: spacing.md },
  countValue: { color: colors.onPrimary, fontSize: 24, fontWeight: "800" },
  countLabel: { color: colors.primaryLight, fontSize: 10, textTransform: "uppercase" },
  card: {
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    gap: spacing.md,
  },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  input: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 15,
  },
  fieldLabel: { color: colors.textMuted, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  chips: { flexDirection: "row", gap: spacing.sm },
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill },
  chipSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primaryBorder },
  chipText: { color: colors.textSecondary, fontSize: 13, fontWeight: "600" },
  chipTextSelected: { color: colors.primaryDark },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.sm },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  link: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  memberRow: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: spacing.md },
  roleRow: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: radius.pill, backgroundColor: colors.primaryLight },
  avatarText: { color: colors.primaryDark, fontSize: 15, fontWeight: "800" },
  memberInfo: { flex: 1 },
  memberName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  memberMeta: { marginTop: 3, color: colors.textMuted, fontSize: 11 },
  moreButton: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  error: { color: colors.danger, fontSize: 13, padding: spacing.sm },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl },
  emptyTitle: { marginTop: spacing.md, color: colors.text, fontSize: 18, fontWeight: "800" },
  emptyText: { marginTop: spacing.sm, color: colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center" },
  setupForm: { width: "100%", marginTop: spacing.lg, gap: spacing.md },
  sheetTitle: { marginBottom: spacing.md, color: colors.text, fontSize: 20, fontWeight: "800" },
  permissionList: { marginVertical: spacing.md, gap: spacing.xs },
  permissionRow: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: spacing.sm },
  permissionLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },
  deleteRoleButton: { marginTop: spacing.md },
});
