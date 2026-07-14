"use client";

import { useEffect, useMemo, useState } from "react";

import {
  type AccountRecord,
  loadSelfProfile,
  registerAccount,
} from "@/lib/account-ids";
import { useAuth } from "@/lib/auth-context";
import {
  MEMBER_PERMISSIONS,
  type PermissionId,
  type TeamRole,
  addMemberByAuditurId,
  assignMemberRole,
  createRole,
  deleteRole,
  listMembers,
  listRoles,
  removeMember,
  updateRole,
} from "@/lib/members-store";
import { tarmac } from "@/lib/tarmac-theme";

function resolveSelfProfile(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null): AccountRecord | null {
  const existing = loadSelfProfile();
  if (existing) return existing;
  if (!user?.email) return null;
  const meta = user.user_metadata ?? {};
  const auditurId = typeof meta.auditur_id === "string" ? meta.auditur_id : undefined;
  const accountType =
    meta.account_type === "owner_gm" || meta.account_type === "employee"
      ? meta.account_type
      : "owner_gm";
  const fullName =
    typeof meta.full_name === "string" && meta.full_name.trim()
      ? meta.full_name
      : user.email.split("@")[0] || "Member";
  return registerAccount({
    fullName,
    email: user.email,
    accountType,
    auditurId,
  });
}

export function MembersPanel() {
  const { user, isAdminBypass } = useAuth();
  const [self, setSelf] = useState<AccountRecord | null>(null);
  const [members, setMembers] = useState(() => listMembers());
  const [roles, setRoles] = useState(() => listRoles());
  const [error, setError] = useState<string | null>(null);
  const [auditurId, setAuditurId] = useState("");
  const [memberRoleId, setMemberRoleId] = useState("");
  const [roleName, setRoleName] = useState("");
  const [rolePermissions, setRolePermissions] = useState<PermissionId[]>([
    "view_dashboard",
    "view_audit",
  ]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  useEffect(() => {
    setSelf(resolveSelfProfile(user));
  }, [user, isAdminBypass]);

  function reload() {
    setMembers(listMembers());
    setRoles(listRoles());
    setSelf(loadSelfProfile());
  }

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const canManageMembers =
    isAdminBypass || !self || self.accountType === "owner_gm";

  function togglePermission(id: PermissionId) {
    setRolePermissions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function handleAddMember() {
    setError(null);
    try {
      addMemberByAuditurId({
        auditurId,
        roleId: memberRoleId || null,
      });
      setAuditurId("");
      setMemberRoleId("");
      reload();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Could not add member.");
    }
  }

  function handleSaveRole() {
    setError(null);
    try {
      if (editingRoleId) {
        updateRole(editingRoleId, { name: roleName, permissions: rolePermissions });
      } else {
        createRole({ name: roleName, permissions: rolePermissions });
      }
      setRoleName("");
      setRolePermissions(["view_dashboard", "view_audit"]);
      setEditingRoleId(null);
      reload();
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "Could not save role.");
    }
  }

  function startEditRole(role: TeamRole) {
    setEditingRoleId(role.id);
    setRoleName(role.name);
    setRolePermissions([...role.permissions]);
  }

  return (
    <div className="panel">
      <div className="hero">
        <div>
          <h2>Members & roles</h2>
          <p>
            Owners and GMs add employees by their 9-digit Auditur ID — no name or email needed once
            they’ve signed up.
          </p>
          {self ? (
            <p className="id-line">
              Your Auditur ID: <strong>{self.auditurId}</strong>
              <span>
                {self.accountType === "owner_gm"
                  ? " · Owner / GM"
                  : " · Employee — share this ID with your owner or GM"}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      {error ? <p className="err">{error}</p> : null}

      <div className="grid">
        <section className="card">
          <h3>Add member by ID</h3>
          {canManageMembers ? (
            <>
              <div className="fields">
                <label>
                  Employee Auditur ID
                  <input
                    value={auditurId}
                    onChange={(e) => setAuditurId(e.target.value.replace(/\D/g, "").slice(0, 9))}
                    placeholder="9-digit ID"
                    inputMode="numeric"
                    maxLength={9}
                  />
                </label>
                <label>
                  Role (optional)
                  <select value={memberRoleId} onChange={(e) => setMemberRoleId(e.target.value)}>
                    <option value="">No role yet</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                disabled={auditurId.length !== 9}
                onClick={handleAddMember}
              >
                Add employee
              </button>
            </>
          ) : (
            <p className="empty">
              Only owners and GMs can add members. Share your Auditur ID above so they can add you.
            </p>
          )}

          <div className="list">
            {members.length === 0 ? (
              <p className="empty">No members yet.</p>
            ) : (
              members.map((member) => (
                <div key={member.id} className="row">
                  <div>
                    <strong>{member.fullName}</strong>
                    <span>
                      ID {member.auditurId ?? "—"}
                      {member.roleId
                        ? ` · ${roleById.get(member.roleId)?.name ?? "Unknown role"}`
                        : " · No role"}
                    </span>
                  </div>
                  {canManageMembers ? (
                    <div className="row-actions">
                      <select
                        value={member.roleId ?? ""}
                        onChange={(e) => {
                          assignMemberRole(member.id, e.target.value || null);
                          reload();
                        }}
                      >
                        <option value="">No role</option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => {
                          removeMember(member.id);
                          reload();
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <h3>{editingRoleId ? "Edit role" : "Create role"}</h3>
          {canManageMembers ? (
            <>
              <label>
                Role name
                <input
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="Lot runner"
                />
              </label>
              <div className="perms">
                {MEMBER_PERMISSIONS.map((permission) => (
                  <label key={permission.id} className="perm">
                    <input
                      type="checkbox"
                      checked={rolePermissions.includes(permission.id)}
                      onChange={() => togglePermission(permission.id)}
                    />
                    <span>
                      <strong>{permission.label}</strong>
                      <em>{permission.description}</em>
                    </span>
                  </label>
                ))}
              </div>
              <div className="row-actions">
                <button type="button" className="btn btn-primary" onClick={handleSaveRole}>
                  {editingRoleId ? "Save role" : "Create role"}
                </button>
                {editingRoleId ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setEditingRoleId(null);
                      setRoleName("");
                      setRolePermissions(["view_dashboard", "view_audit"]);
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="empty">Role management is limited to owners and GMs.</p>
          )}

          <div className="list">
            {roles.map((role) => {
              const assignees = members.filter((m) => m.roleId === role.id);
              return (
                <div key={role.id} className="row role-row">
                  <div>
                    <strong>{role.name}</strong>
                    <span>
                      {role.permissions.length} permission
                      {role.permissions.length === 1 ? "" : "s"} ·{" "}
                      {assignees.length === 0
                        ? "No members assigned"
                        : assignees.map((m) => m.fullName).join(", ")}
                    </span>
                  </div>
                  {canManageMembers ? (
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => startEditRole(role)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => {
                          deleteRole(role.id);
                          if (editingRoleId === role.id) setEditingRoleId(null);
                          reload();
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <style jsx>{`
        .panel { position: relative; z-index: 1; }
        .hero {
          margin-bottom: 1rem; padding: 1.15rem 1.2rem; border: 1px solid ${tarmac.line};
          border-radius: 10px; background: ${tarmac.asphaltCard};
        }
        h2 { margin: 0; font-size: 1.05rem; }
        h3 { margin: 0 0 0.85rem; font-size: 0.92rem; color: ${tarmac.teal}; text-transform: uppercase; letter-spacing: 0.08em; }
        .hero p { margin: 0.4rem 0 0; color: ${tarmac.slate}; font-size: 0.86rem; max-width: 40rem; line-height: 1.45; }
        .id-line { color: ${tarmac.text} !important; }
        .id-line strong {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: 0.06em;
          color: ${tarmac.teal};
        }
        .grid { display: grid; gap: 1rem; }
        @media (min-width: 960px) {
          .grid { grid-template-columns: 1fr 1fr; align-items: start; }
        }
        .card {
          padding: 1.1rem; border-radius: 10px; border: 1px solid ${tarmac.lineDim};
          background: ${tarmac.asphaltCard}; display: grid; gap: 0.85rem;
        }
        .fields { display: grid; gap: 0.65rem; }
        label { display: grid; gap: 0.3rem; font-size: 0.72rem; color: ${tarmac.slate}; text-transform: uppercase; letter-spacing: 0.06em; }
        input, select {
          padding: 0.65rem 0.85rem; min-height: 2.55rem; border-radius: 999px; border: 1px solid ${tarmac.line};
          background: #0b1220; color: ${tarmac.text}; font-size: 0.9rem; text-transform: none; letter-spacing: normal;
          box-sizing: border-box;
        }
        .btn {
          display: inline-flex; align-items: center; justify-content: center;
          min-height: 2.55rem; padding: 0.65rem 1.05rem; border-radius: 999px;
          font-size: 0.86rem; font-weight: 700; line-height: 1; cursor: pointer;
          border: 1px solid transparent; box-sizing: border-box; width: fit-content;
        }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-primary {
          background: ${tarmac.teal}; color: #042f2e; border-color: ${tarmac.teal};
        }
        .btn-ghost {
          background: rgba(15, 23, 42, 0.55); color: ${tarmac.text}; border-color: ${tarmac.line};
        }
        .btn-danger {
          background: rgba(15, 23, 42, 0.55); color: ${tarmac.danger};
          border-color: rgba(248,113,113,0.45);
        }
        .list { display: grid; gap: 0.55rem; margin-top: 0.35rem; }
        .row {
          display: flex; justify-content: space-between; gap: 0.85rem; flex-wrap: wrap;
          padding: 0.85rem 0.95rem; border-radius: 8px; border: 1px solid ${tarmac.lineDim};
          background: ${tarmac.asphaltLight};
        }
        .row strong { display: block; }
        .row span, .empty, .err { color: #cbd5e1; font-size: 0.78rem; }
        .err { color: ${tarmac.danger}; }
        .row-actions { display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap; }
        .perms { display: grid; gap: 0.45rem; }
        .perm {
          display: flex; gap: 0.65rem; align-items: flex-start; padding: 0.55rem 0.65rem;
          border-radius: 8px; border: 1px solid ${tarmac.lineDim}; background: ${tarmac.asphaltLight};
          text-transform: none; letter-spacing: normal;
        }
        .perm strong { display: block; color: ${tarmac.text}; font-size: 0.86rem; }
        .perm em { display: block; color: #cbd5e1; font-size: 0.75rem; font-style: normal; margin-top: 0.15rem; }
      `}</style>
    </div>
  );
}
