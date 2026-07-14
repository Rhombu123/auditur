"use client";

import { useEffect, useState } from "react";

import {
  type AccountRecord,
  loadSelfProfile,
  registerAccount,
} from "@/lib/account-ids";
import { displayName, useAuth } from "@/lib/auth-context";
import { tarmac } from "@/lib/tarmac-theme";

function resolveProfile(user: {
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

export function ProfilePanel() {
  const { user, isAdminBypass } = useAuth();
  const [profile, setProfile] = useState<AccountRecord | null>(null);

  useEffect(() => {
    setProfile(resolveProfile(user));
  }, [user, isAdminBypass]);

  const roleLabel =
    profile?.accountType === "employee"
      ? "Dealership employee"
      : isAdminBypass
        ? "Admin"
        : "Dealership owner / GM";

  return (
    <div className="panel">
      <div className="desk-panel-hero">
        <div>
          <h2>Profile</h2>
          <p>Your Auditur account details for this dealership desk.</p>
        </div>
      </div>

      <div className="card">
        <div className="avatar" aria-hidden>
          {(profile?.fullName || displayName(user)).slice(0, 1).toUpperCase()}
        </div>
        <div className="fields">
          <div>
            <span className="k">Name</span>
            <strong>{profile?.fullName || displayName(user)}</strong>
          </div>
          <div>
            <span className="k">Email</span>
            <strong>{profile?.email || user?.email || "—"}</strong>
          </div>
          <div>
            <span className="k">Account type</span>
            <strong>{roleLabel}</strong>
          </div>
          <div>
            <span className="k">Auditur ID</span>
            <strong className="mono">{profile?.auditurId ?? "—"}</strong>
          </div>
        </div>
      </div>

      <style jsx>{`
        .panel { position: relative; z-index: 1; }
        .card {
          display: flex;
          gap: 1.25rem;
          flex-wrap: wrap;
          align-items: flex-start;
          padding: 1.25rem;
          border-radius: 10px;
          border: 1px solid ${tarmac.lineDim};
          background: ${tarmac.surface};
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
        }
        .avatar {
          width: 3rem;
          height: 3rem;
          border-radius: 10px;
          background: ${tarmac.tealSoft};
          color: ${tarmac.tealDeep};
          display: grid;
          place-items: center;
          font-weight: 800;
          font-size: 1.15rem;
        }
        .fields {
          display: grid;
          gap: 0.85rem;
          min-width: 220px;
          flex: 1;
        }
        .k {
          display: block;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: ${tarmac.slate};
          margin-bottom: 0.15rem;
        }
        strong {
          display: block;
          font-size: 0.92rem;
          color: ${tarmac.text};
          font-weight: 600;
        }
        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
          letter-spacing: 0.06em;
          color: ${tarmac.tealDeep};
        }
      `}</style>
    </div>
  );
}
