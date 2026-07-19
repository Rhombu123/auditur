import type { PermissionId } from "@/lib/permissions";
import { supabase } from "@/lib/supabase-browser";

export type TeamMember = {
  userId: string;
  fullName: string;
  auditurId: string;
  membershipKind: "owner" | "member";
  roleId: string | null;
  joinedAt: string;
};

export type TeamRole = {
  id: string;
  name: string;
  permissions: PermissionId[];
  createdAt: string;
};

export async function listTeamMembers(dealershipId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from("dealership_members")
    .select(
      "user_id, membership_kind, role_id, joined_at, profiles!dealership_members_user_profile_fk(full_name, auditur_id)",
    )
    .eq("dealership_id", dealershipId)
    .order("joined_at");
  if (error) throw error;
  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
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

export async function listTeamRoles(dealershipId: string): Promise<TeamRole[]> {
  const { data, error } = await supabase
    .from("dealership_roles")
    .select("id, name, created_at, dealership_role_permissions(permission)")
    .eq("dealership_id", dealershipId)
    .order("created_at");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    permissions: (row.dealership_role_permissions ?? []).map(
      (item) => item.permission as PermissionId,
    ),
  }));
}

export async function addTeamMember(
  dealershipId: string,
  auditurId: string,
  roleId: string | null,
) {
  const { error } = await supabase.rpc("add_dealership_member_by_auditur_id", {
    target_dealership_id: dealershipId,
    target_auditur_id: auditurId,
    target_role_id: roleId,
  });
  if (error) throw error;
}

export async function assignTeamMemberRole(
  dealershipId: string,
  userId: string,
  roleId: string | null,
) {
  const { error } = await supabase.rpc("assign_dealership_member_role", {
    target_dealership_id: dealershipId,
    target_user_id: userId,
    target_role_id: roleId,
  });
  if (error) throw error;
}

export async function removeTeamMember(dealershipId: string, userId: string) {
  const { error } = await supabase.rpc("remove_dealership_member", {
    target_dealership_id: dealershipId,
    target_user_id: userId,
  });
  if (error) throw error;
}

export async function transferDealershipOwnership(
  dealershipId: string,
  userId: string,
) {
  const { error } = await supabase.rpc("transfer_dealership_ownership", {
    target_dealership_id: dealershipId,
    target_user_id: userId,
  });
  if (error) throw error;
}

export async function saveTeamRole(
  dealershipId: string,
  input: { id?: string; name: string; permissions: PermissionId[] },
) {
  const rpc = input.id ? "update_dealership_role" : "create_dealership_role";
  const args = input.id
    ? {
        target_dealership_id: dealershipId,
        target_role_id: input.id,
        role_name: input.name,
        requested_permissions: input.permissions,
      }
    : {
        target_dealership_id: dealershipId,
        role_name: input.name,
        requested_permissions: input.permissions,
      };
  const { error } = await supabase.rpc(rpc, args);
  if (error) throw error;
}

export async function deleteTeamRole(dealershipId: string, roleId: string) {
  const { error } = await supabase.rpc("delete_dealership_role", {
    target_dealership_id: dealershipId,
    target_role_id: roleId,
  });
  if (error) throw error;
}
