import type { TeamMember, TeamRole } from "@/lib/dealership-types";
import type { PermissionId } from "@/lib/permissions";
import { supabase } from "@/lib/supabase";

export async function listTeamMembers(
  dealershipId: string,
): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("dealership_members")
    .select("user_id, membership_kind, role_id, joined_at")
    .eq("dealership_id", dealershipId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("user_id, full_name, auditur_id")
    .in(
      "user_id",
      rows.map((row) => row.user_id),
    );
  if (profilesError) throw profilesError;
  const profilesById = new Map(
    (profiles ?? []).map((profile) => [profile.user_id, profile]),
  );

  return rows.map((row) => {
    const profile = profilesById.get(row.user_id);
    return {
      userId: row.user_id,
      fullName: profile?.full_name ?? "Team member",
      auditurId: profile?.auditur_id ?? "—",
      membershipKind: row.membership_kind === "owner" ? "owner" : "member",
      roleId: row.role_id,
      joinedAt: row.joined_at,
    };
  });
}

export async function listTeamRoles(
  dealershipId: string,
): Promise<TeamRole[]> {
  const { data, error } = await supabase
    .from("dealership_roles")
    .select("id, name, created_at")
    .eq("dealership_id", dealershipId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: permissions, error: permissionsError } = await supabase
    .from("dealership_role_permissions")
    .select("role_id, permission")
    .in(
      "role_id",
      rows.map((row) => row.id),
    );
  if (permissionsError) throw permissionsError;
  const permissionsByRole = new Map<string, PermissionId[]>();
  for (const entry of permissions ?? []) {
    const rolePermissions = permissionsByRole.get(entry.role_id) ?? [];
    rolePermissions.push(entry.permission as PermissionId);
    permissionsByRole.set(entry.role_id, rolePermissions);
  }

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    permissions: permissionsByRole.get(row.id) ?? [],
  }));
}

export async function addTeamMember(
  dealershipId: string,
  auditurId: string,
  roleId: string | null,
): Promise<void> {
  const { error } = await supabase.rpc(
    "add_dealership_member_by_auditur_id",
    {
      target_dealership_id: dealershipId,
      target_auditur_id: auditurId,
      target_role_id: roleId,
    },
  );
  if (error) throw error;
}

export async function assignTeamMemberRole(
  dealershipId: string,
  userId: string,
  roleId: string | null,
): Promise<void> {
  const { error } = await supabase.rpc("assign_dealership_member_role", {
    target_dealership_id: dealershipId,
    target_user_id: userId,
    target_role_id: roleId,
  });
  if (error) throw error;
}

export async function removeTeamMember(
  dealershipId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc("remove_dealership_member", {
    target_dealership_id: dealershipId,
    target_user_id: userId,
  });
  if (error) throw error;
}

export async function transferDealershipOwnership(
  dealershipId: string,
  userId: string,
): Promise<void> {
  const { error } = await supabase.rpc("transfer_dealership_ownership", {
    target_dealership_id: dealershipId,
    target_user_id: userId,
  });
  if (error) throw error;
}

export async function createTeamRole(
  dealershipId: string,
  name: string,
  permissions: PermissionId[],
): Promise<void> {
  const { error } = await supabase.rpc("create_dealership_role", {
    target_dealership_id: dealershipId,
    role_name: name,
    requested_permissions: permissions,
  });
  if (error) throw error;
}

export async function updateTeamRole(
  dealershipId: string,
  roleId: string,
  name: string,
  permissions: PermissionId[],
): Promise<void> {
  const { error } = await supabase.rpc("update_dealership_role", {
    target_dealership_id: dealershipId,
    target_role_id: roleId,
    role_name: name,
    requested_permissions: permissions,
  });
  if (error) throw error;
}

export async function deleteTeamRole(
  dealershipId: string,
  roleId: string,
): Promise<void> {
  const { error } = await supabase.rpc("delete_dealership_role", {
    target_dealership_id: dealershipId,
    target_role_id: roleId,
  });
  if (error) throw error;
}

export async function updateDealershipName(
  dealershipId: string,
  name: string,
): Promise<void> {
  const { error } = await supabase.rpc("update_dealership_name", {
    target_dealership_id: dealershipId,
    dealership_name: name,
  });
  if (error) throw error;
}
