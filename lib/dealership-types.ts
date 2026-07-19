import type { PermissionId } from "@/lib/permissions";

export type DealershipAccess = {
  dealershipId: string;
  dealershipName: string;
  membershipKind: "owner" | "member";
  roleId: string | null;
  roleName: string | null;
  permissions: PermissionId[];
  isActive: boolean;
};

export type TeamRole = {
  id: string;
  name: string;
  permissions: PermissionId[];
  createdAt: string;
};

export type TeamMember = {
  userId: string;
  fullName: string;
  auditurId: string;
  membershipKind: "owner" | "member";
  roleId: string | null;
  joinedAt: string;
};
