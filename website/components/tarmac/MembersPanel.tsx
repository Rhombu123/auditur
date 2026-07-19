"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { useDealership } from "@/lib/dealership-context";
import { adminResetMemberMfa } from "@/lib/mfa-api";
import {
  DEALERSHIP_PERMISSIONS,
  type PermissionId,
} from "@/lib/permissions";
import {
  addTeamMember,
  assignTeamMemberRole,
  deleteTeamRole,
  listTeamMembers,
  listTeamRoles,
  removeTeamMember,
  saveTeamRole,
  transferDealershipOwnership,
  type TeamMember,
  type TeamRole,
} from "@/lib/team-api";

export function MembersPanel() {
  const { isAdminBypass } = useAuth();
  const { activeDealership, hasPermission, refreshAccess } = useDealership();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [roles, setRoles] = useState<TeamRole[]>([]);
  const [auditurId, setAuditurId] = useState("");
  const [memberRoleId, setMemberRoleId] = useState("");
  const [editingRole, setEditingRole] = useState<TeamRole | null>(null);
  const [roleName, setRoleName] = useState("");
  const [rolePermissions, setRolePermissions] = useState<PermissionId[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManageMembers = hasPermission("manage_members");
  const canManageRoles = hasPermission("manage_roles");
  const roleById = useMemo(() => new Map(roles.map((role) => [role.id, role])), [roles]);

  const reload = useCallback(async () => {
    if (!activeDealership || isAdminBypass) return;
    setError(null);
    try {
      const [nextMembers, nextRoles] = await Promise.all([
        listTeamMembers(activeDealership.dealershipId),
        listTeamRoles(activeDealership.dealershipId),
      ]);
      setMembers(nextMembers);
      setRoles(nextRoles);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load team.");
    }
  }, [activeDealership, isAdminBypass]);

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

  function resetRoleEditor() {
    setEditingRole(null);
    setRoleName("");
    setRolePermissions([]);
  }

  if (!activeDealership) {
    return <p className="desk-error">Create or join a dealership to manage a team.</p>;
  }
  if (isAdminBypass) {
    return (
      <div className="desk-banner">
        Team authorization uses real Supabase accounts and is unavailable in local demo mode.
      </div>
    );
  }

  return (
    <div className="team-panel">
      <div className="desk-panel-hero">
        <div>
          <h2>{activeDealership.dealershipName} team</h2>
          <p>Add signed-up employees by their 9-digit Auditur ID and control access with roles.</p>
        </div>
        <strong>{members.length} members</strong>
      </div>

      {error ? <div className="desk-error">{error}</div> : null}

      <div className="team-grid">
        <section className="team-card">
          <h3>Members</h3>
          {canManageMembers ? (
            <div className="add-row">
              <input
                className="desk-input"
                inputMode="numeric"
                maxLength={9}
                placeholder="9-digit Auditur ID"
                value={auditurId}
                onChange={(event) =>
                  setAuditurId(event.target.value.replace(/\D/g, "").slice(0, 9))
                }
              />
              <select
                className="desk-select"
                value={memberRoleId}
                onChange={(event) => setMemberRoleId(event.target.value)}
              >
                <option value="">No role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              <button
                className="ui-btn ui-btn-primary"
                disabled={busy || auditurId.length !== 9}
                onClick={() =>
                  void run(async () => {
                    await addTeamMember(
                      activeDealership.dealershipId,
                      auditurId,
                      memberRoleId || null,
                    );
                    setAuditurId("");
                    setMemberRoleId("");
                  })
                }
              >
                Add employee
              </button>
            </div>
          ) : null}

          <div className="team-list">
            {members.map((member) => (
              <div className="member-row" key={member.userId}>
                <div>
                  <strong>{member.fullName}</strong>
                  <span>
                    ID {member.auditurId} · {member.membershipKind === "owner"
                      ? "Owner / GM"
                      : roleById.get(member.roleId ?? "")?.name ?? "No role"}
                  </span>
                </div>
                {canManageMembers && member.membershipKind !== "owner" ? (
                  <div className="row-actions">
                    <select
                      className="desk-select"
                      disabled={busy || !canManageRoles}
                      value={member.roleId ?? ""}
                      onChange={(event) =>
                        void run(() =>
                          assignTeamMemberRole(
                            activeDealership.dealershipId,
                            member.userId,
                            event.target.value || null,
                          ),
                        )
                      }
                    >
                      <option value="">No role</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                    {activeDealership.membershipKind === "owner" ? (
                      <button
                        className="ui-btn ui-btn-secondary"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Transfer dealership ownership to ${member.fullName}? You will lose owner access immediately.`,
                            )
                          ) {
                            void run(() =>
                              transferDealershipOwnership(
                                activeDealership.dealershipId,
                                member.userId,
                              ),
                            );
                          }
                        }}
                      >
                        Transfer ownership
                      </button>
                    ) : null}
                    <button
                      className="ui-btn ui-btn-secondary"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            `Reset MFA for ${member.fullName}? Their sessions will be revoked and they must enroll again.`,
                          )
                        ) {
                          void run(() => adminResetMemberMfa(member.userId));
                        }
                      }}
                    >
                      Reset MFA
                    </button>
                    <button
                      className="ui-btn ui-btn-danger"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Remove ${member.fullName} from this team?`)) {
                          void run(() =>
                            removeTeamMember(activeDealership.dealershipId, member.userId),
                          );
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
            {members.length === 0 ? <p className="empty">No members yet.</p> : null}
          </div>
        </section>

        <section className="team-card">
          <h3>{editingRole ? "Edit role" : "Create role"}</h3>
          {canManageRoles ? (
            <>
              <input
                className="desk-input"
                placeholder="Role name"
                value={roleName}
                onChange={(event) => setRoleName(event.target.value)}
              />
              <div className="permissions">
                {DEALERSHIP_PERMISSIONS.filter(
                  (permission) => permission.id !== "manage_dealership",
                ).map((permission) => (
                  <label key={permission.id}>
                    <input
                      type="checkbox"
                      checked={rolePermissions.includes(permission.id)}
                      onChange={() =>
                        setRolePermissions((current) =>
                          current.includes(permission.id)
                            ? current.filter((id) => id !== permission.id)
                            : [...current, permission.id],
                        )
                      }
                    />
                    <span>{permission.label}</span>
                  </label>
                ))}
              </div>
              <div className="row-actions">
                <button
                  className="ui-btn ui-btn-primary"
                  disabled={busy || !roleName.trim()}
                  onClick={() =>
                    void run(async () => {
                      await saveTeamRole(activeDealership.dealershipId, {
                        id: editingRole?.id,
                        name: roleName,
                        permissions: rolePermissions,
                      });
                      resetRoleEditor();
                    })
                  }
                >
                  {editingRole ? "Save role" : "Create role"}
                </button>
                {editingRole ? (
                  <button className="ui-btn ui-btn-secondary" onClick={resetRoleEditor}>
                    Cancel
                  </button>
                ) : null}
              </div>
            </>
          ) : (
            <p className="empty">You can view roles but cannot change them.</p>
          )}

          <div className="team-list">
            {roles.map((role) => (
              <div className="member-row" key={role.id}>
                <div>
                  <strong>{role.name}</strong>
                  <span>{role.permissions.length} permissions</span>
                </div>
                {canManageRoles ? (
                  <div className="row-actions">
                    <button
                      className="ui-btn ui-btn-secondary"
                      onClick={() => {
                        setEditingRole(role);
                        setRoleName(role.name);
                        setRolePermissions([...role.permissions]);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="ui-btn ui-btn-danger"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Delete the ${role.name} role?`)) {
                          void run(() =>
                            deleteTeamRole(activeDealership.dealershipId, role.id),
                          );
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      </div>

      <style jsx>{`
        .team-panel, .team-card, .team-list, .permissions { display: grid; gap: .85rem; }
        .team-grid { display: grid; gap: 1rem; }
        .team-card { padding: 1rem; border: 1px solid var(--desk-line); border-radius: 10px; background: #fff; }
        .team-card h3 { margin: 0; color: #0f766e; font-size: .78rem; text-transform: uppercase; letter-spacing: .07em; }
        .add-row { display: grid; grid-template-columns: 1fr 1fr auto; gap: .55rem; }
        .member-row { display: flex; align-items: center; justify-content: space-between; gap: .8rem; flex-wrap: wrap; padding: .8rem; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
        .member-row strong, .member-row span { display: block; }
        .member-row span, .empty { margin-top: .2rem; color: #64748b; font-size: .78rem; }
        .row-actions { display: flex; gap: .45rem; align-items: center; flex-wrap: wrap; }
        .permissions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .permissions label { display: flex; gap: .5rem; align-items: center; color: #334155; font-size: .82rem; }
        @media (min-width: 980px) { .team-grid { grid-template-columns: 1.15fr .85fr; align-items: start; } }
        @media (max-width: 720px) { .add-row, .permissions { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
