import { isAdminBypassActive } from "@/lib/admin-access";
import { lookupAccountById } from "@/lib/account-ids";

const STORAGE_KEY = "auditur.members.v1";

export const MEMBER_PERMISSIONS = [
  {
    id: "view_dashboard",
    label: "View dashboard",
    description: "See lot status overview and live scan feed.",
  },
  {
    id: "view_audit",
    label: "View audit",
    description: "Open audit lists and completion for a price list.",
  },
  {
    id: "manage_uploads",
    label: "Manage uploads",
    description: "Upload and delete price-list PDFs.",
  },
  {
    id: "export_audits",
    label: "Export audits",
    description: "Download highlighted audit PDFs.",
  },
  {
    id: "manage_vehicles",
    label: "Manage vehicles",
    description: "Edit or delete scanned vehicle records.",
  },
  {
    id: "manage_map",
    label: "Manage map & sections",
    description: "Lock the lot view, paint sections, and edit zone colors.",
  },
  {
    id: "manage_members",
    label: "Manage members",
    description: "Invite or remove employees on this account.",
  },
  {
    id: "manage_roles",
    label: "Manage roles",
    description: "Create roles and assign permissions.",
  },
] as const;

export type PermissionId = (typeof MEMBER_PERMISSIONS)[number]["id"];

export type TeamMember = {
  id: string;
  fullName: string;
  email: string;
  auditurId: string | null;
  roleId: string | null;
  createdAt: string;
};

export type TeamRole = {
  id: string;
  name: string;
  permissions: PermissionId[];
  createdAt: string;
};

type MembersState = {
  members: TeamMember[];
  roles: TeamRole[];
};

function emptyState(): MembersState {
  return { members: [], roles: [] };
}

function readState(): MembersState {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seed = seedForAdmin();
      writeState(seed);
      return seed;
    }
    const parsed = JSON.parse(raw) as MembersState;
    return {
      roles: parsed.roles ?? [],
      members: (parsed.members ?? []).map((m) => ({
        ...m,
        auditurId: m.auditurId ?? null,
      })),
    };
  } catch {
    const seed = seedForAdmin();
    writeState(seed);
    return seed;
  }
}

function writeState(state: MembersState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function seedForAdmin(): MembersState {
  if (typeof window === "undefined") return emptyState();
  // Seed only when admin is exploring so Members isn't an empty void.
  if (!isAdminBypassActive()) return emptyState();
  const yardId = "role-yard";
  const mgrId = "role-manager";
  return {
    roles: [
      {
        id: yardId,
        name: "Lot runner",
        permissions: ["view_dashboard", "view_audit", "manage_map"],
        createdAt: new Date().toISOString(),
      },
      {
        id: mgrId,
        name: "Lot manager",
        permissions: [
          "view_dashboard",
          "view_audit",
          "manage_uploads",
          "export_audits",
          "manage_vehicles",
          "manage_map",
        ],
        createdAt: new Date().toISOString(),
      },
    ],
    members: [
      {
        id: "member-1",
        fullName: "Jordan Lee",
        email: "jordan@dealership.example",
        auditurId: "482736195",
        roleId: yardId,
        createdAt: new Date().toISOString(),
      },
      {
        id: "member-2",
        fullName: "Sam Ortiz",
        email: "sam@dealership.example",
        auditurId: "719384026",
        roleId: mgrId,
        createdAt: new Date().toISOString(),
      },
    ],
  };
}

export function listMembers(): TeamMember[] {
  return readState().members;
}

export function listRoles(): TeamRole[] {
  return readState().roles;
}

export function addMember(input: {
  fullName: string;
  email: string;
  roleId?: string | null;
  auditurId?: string | null;
}) {
  const state = readState();
  const email = input.email.trim().toLowerCase();
  if (!input.fullName.trim()) throw new Error("Name is required.");
  if (!email.includes("@")) throw new Error("Enter a valid email.");
  if (state.members.some((m) => m.email === email)) {
    throw new Error("That email is already on the team.");
  }
  const auditurId = input.auditurId?.trim() || null;
  if (auditurId && state.members.some((m) => m.auditurId === auditurId)) {
    throw new Error("That Auditur ID is already on the team.");
  }
  state.members.unshift({
    id: `member-${Date.now()}`,
    fullName: input.fullName.trim(),
    email,
    auditurId,
    roleId: input.roleId ?? null,
    createdAt: new Date().toISOString(),
  });
  writeState(state);
}

/** Owner/GM adds an employee using their 9-digit Auditur ID (not name/email). */
export function addMemberByAuditurId(input: {
  auditurId: string;
  roleId?: string | null;
}) {
  const auditurId = input.auditurId.trim();
  if (!/^\d{9}$/.test(auditurId)) {
    throw new Error("Enter a valid 9-digit Auditur ID.");
  }
  const account = lookupAccountById(auditurId);
  if (!account) {
    throw new Error("No signed-up user found for that ID.");
  }
  if (account.accountType === "owner_gm") {
    throw new Error("That ID belongs to an owner/GM — only employees can be added here.");
  }
  addMember({
    fullName: account.fullName,
    email: account.email,
    roleId: input.roleId,
    auditurId: account.auditurId,
  });
}

export function removeMember(id: string) {
  const state = readState();
  state.members = state.members.filter((m) => m.id !== id);
  writeState(state);
}

export function assignMemberRole(memberId: string, roleId: string | null) {
  const state = readState();
  const member = state.members.find((m) => m.id === memberId);
  if (!member) throw new Error("Member not found.");
  member.roleId = roleId;
  writeState(state);
}

export function createRole(input: { name: string; permissions: PermissionId[] }) {
  const state = readState();
  const name = input.name.trim();
  if (!name) throw new Error("Role name is required.");
  if (state.roles.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("A role with that name already exists.");
  }
  state.roles.unshift({
    id: `role-${Date.now()}`,
    name,
    permissions: input.permissions,
    createdAt: new Date().toISOString(),
  });
  writeState(state);
}

export function updateRole(
  id: string,
  input: { name: string; permissions: PermissionId[] },
) {
  const state = readState();
  const role = state.roles.find((r) => r.id === id);
  if (!role) throw new Error("Role not found.");
  const name = input.name.trim();
  if (!name) throw new Error("Role name is required.");
  if (
    state.roles.some((r) => r.id !== id && r.name.toLowerCase() === name.toLowerCase())
  ) {
    throw new Error("A role with that name already exists.");
  }
  role.name = name;
  role.permissions = input.permissions;
  writeState(state);
}

export function deleteRole(id: string) {
  const state = readState();
  state.roles = state.roles.filter((r) => r.id !== id);
  for (const member of state.members) {
    if (member.roleId === id) member.roleId = null;
  }
  writeState(state);
}
