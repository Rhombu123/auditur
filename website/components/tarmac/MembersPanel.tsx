"use client";

import { useMemo, useState } from "react";

import {
  MEMBER_PERMISSIONS,
  type PermissionId,
  type TeamMember,
  type TeamRole,
  addMember,
  assignMemberRole,
  createRole,
  deleteRole,
  listMembers,
  listRoles,
  removeMember,
  updateRole,
} from "@/lib/members-store";
import { tarmac } from "@/lib/tarmac-theme";

export function MembersPanel() {
  const [members, setMembers] = useState<TeamMember[]>(() => listMembers());
  const [roles, setRoles] = useState<TeamRole[]>(() => listRoles());
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [memberRoleId, setMemberRoleId] = useState<string>("");
  const [roleName, setRoleName] = useState("");
  const [rolePermissions, setRolePermissions] = useState<PermissionId[]>([
    "view_dashboard",
    "view_audit",
  ]);
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);

  function reload() {
    setMembers(listMembers());
    setRoles(listRoles());
  }

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  function togglePermission(id: PermissionId) {
    setRolePermissions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  }

  function handleAddMember() {
    setError(null);
    try {
      addMember({
        fullName: name,
        email,
        roleId: memberRoleId || null,
      });
      setName("");
      setEmail("");
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
            Add employees to this account, then create custom roles with permissions and assign
            people to them.
          </p>
        </div>
      </div>

      {error ? <p className="err">{error}</p> : null}

      <div className="grid">
        <section className="card">
          <h3>Add member</h3>
          <div className="fields">
            <label>
              Full name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" />
            </label>
            <label>
              Work email
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jordan@dealership.com"
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
          <button type="button" className="primary" onClick={handleAddMember}>
            Add employee
          </button>

          <div className="list">
            {members.length === 0 ? (
              <p className="empty">No members yet.</p>
            ) : (
              members.map((member) => (
                <div key={member.id} className="row">
                  <div>
                    <strong>{member.fullName}</strong>
                    <span>
                      {member.email}
                      {member.roleId
                        ? ` · ${roleById.get(member.roleId)?.name ?? "Unknown role"}`
                        : " · No role"}
                    </span>
                  </div>
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
                      className="danger"
                      onClick={() => {
                        removeMember(member.id);
                        reload();
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="card">
          <h3>{editingRoleId ? "Edit role" : "Create role"}</h3>
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
            <button type="button" className="primary" onClick={handleSaveRole}>
              {editingRoleId ? "Save role" : "Create role"}
            </button>
            {editingRoleId ? (
              <button
                type="button"
                className="ghost"
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
                  <div className="row-actions">
                    <button type="button" className="ghost" onClick={() => startEditRole(role)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        deleteRole(role.id);
                        if (editingRoleId === role.id) setEditingRoleId(null);
                        reload();
                      }}
                    >
                      Delete
                    </button>
                  </div>
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
          padding: 0.6rem 0.75rem; border-radius: 8px; border: 1px solid ${tarmac.line};
          background: #0b1220; color: ${tarmac.text}; font-size: 0.9rem; text-transform: none; letter-spacing: normal;
        }
        .primary {
          border: none; border-radius: 999px; padding: 0.7rem 1rem; width: fit-content;
          background: ${tarmac.teal}; color: #042f2e; font-weight: 800; cursor: pointer;
        }
        .ghost, .danger {
          border: 1px solid ${tarmac.line}; background: transparent; color: ${tarmac.text};
          border-radius: 999px; padding: 0.5rem 0.8rem; font-weight: 700; cursor: pointer;
        }
        .danger { color: ${tarmac.danger}; border-color: rgba(248,113,113,0.45); }
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
