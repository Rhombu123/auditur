"use client";

import { useEffect, useState } from "react";

import {
  type AccountRecord,
  loadSelfProfile,
  registerAccount,
  updateSelfProfile,
} from "@/lib/account-ids";
import { displayName, useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase-browser";
import { tarmac } from "@/lib/tarmac-theme";

function resolveProfile(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
} | null): AccountRecord | null {
  const existing = loadSelfProfile();
  if (!user?.email) return existing;
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
  const dealershipName =
    typeof meta.dealership_name === "string" ? meta.dealership_name : undefined;
  return registerAccount({
    fullName,
    email: user.email,
    accountType,
    auditurId,
    dealershipName,
  });
}

export function ProfilePanel() {
  const { user, isAdminBypass } = useAuth();
  const [profile, setProfile] = useState<AccountRecord | null>(null);
  const [fullName, setFullName] = useState("");
  const [dealershipName, setDealershipName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const next = resolveProfile(user);
    setProfile(next);
    setFullName(next?.fullName ?? displayName(user));
    setDealershipName(next?.dealershipName ?? "");
  }, [user, isAdminBypass]);

  const roleLabel =
    profile?.accountType === "employee"
      ? "Dealership employee"
      : isAdminBypass
        ? "Admin"
        : "Dealership owner / GM";

  async function handleSave() {
    if (!profile || !fullName.trim()) return;
    setSaving(true);
    setMessage(null);
    try {
      if (!isAdminBypass) {
        const { error } = await supabase.auth.updateUser({
          data: {
            ...(user?.user_metadata ?? {}),
            full_name: fullName.trim(),
            dealership_name: dealershipName.trim() || null,
          },
        });
        if (error) throw error;
      }
      const next = updateSelfProfile({
        fullName,
        dealershipName,
      });
      if (next) setProfile(next);
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyId() {
    if (!profile?.auditurId) return;
    await navigator.clipboard.writeText(profile.auditurId);
    setMessage("Auditur ID copied.");
  }

  return (
    <div className="panel">
      <div className="desk-panel-hero">
        <div>
          <h2>Profile</h2>
          <p>Your Auditur account details for this dealership desk.</p>
        </div>
      </div>

      {message ? <p className="msg">{message}</p> : null}

      <div className="card identity-card">
        <div className="avatar" aria-hidden>
          {(profile?.fullName || displayName(user)).slice(0, 1).toUpperCase()}
        </div>
        <div className="fields">
          <label>
            <span className="k">Name</span>
            <input
              className="desk-input"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              autoComplete="name"
            />
          </label>
          <label>
            <span className="k">Dealership / workspace</span>
            <input
              className="desk-input"
              value={dealershipName}
              onChange={(event) => setDealershipName(event.target.value)}
              placeholder="Your dealership name"
              autoComplete="organization"
            />
          </label>
          <div className="read-only">
            <span className="k">Email</span>
            <strong>{profile?.email || user?.email || "—"}</strong>
          </div>
          <div className="read-only">
            <span className="k">Account type</span>
            <strong>{roleLabel}</strong>
          </div>
          <div className="read-only id-field">
            <span className="k">Auditur ID</span>
            <div>
              <strong className="mono">{profile?.auditurId ?? "—"}</strong>
              <button
                type="button"
                className="ui-btn ui-btn-secondary"
                disabled={!profile?.auditurId}
                onClick={() => void handleCopyId()}
              >
                Copy
              </button>
            </div>
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-primary save"
            disabled={saving || !fullName.trim()}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </div>
      </div>

      <div className="card support-card">
        <div>
          <span className="k">Account support</span>
          <strong>Need help or want your account deleted?</strong>
          <p>Send a request from the email attached to this account.</p>
        </div>
        <a
          className="ui-btn ui-btn-secondary"
          href={`mailto:support@auditur.app?subject=${encodeURIComponent("Auditur account support")}`}
        >
          Contact support
        </a>
      </div>

      <style jsx>{`
        .panel { position: relative; z-index: 1; }
        .msg {
          margin: 0 0 0.85rem;
          color: ${tarmac.tealDeep};
          font-size: 0.84rem;
        }
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
        .identity-card { margin-bottom: 0.75rem; }
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
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
        .fields label:first-child,
        .fields label:nth-child(2),
        .id-field {
          grid-column: 1 / -1;
        }
        .read-only {
          min-height: 3.5rem;
          padding: 0.7rem 0.8rem;
          border: 1px solid ${tarmac.lineDim};
          border-radius: 8px;
          background: ${tarmac.canvas};
        }
        .id-field > div {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
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
        .save {
          grid-column: 1 / -1;
          justify-self: start;
        }
        .support-card {
          align-items: center;
          justify-content: space-between;
        }
        .support-card p {
          margin: 0.3rem 0 0;
          color: ${tarmac.slate};
          font-size: 0.8rem;
        }
        @media (max-width: 640px) {
          .fields { grid-template-columns: 1fr; }
          .fields label,
          .read-only,
          .id-field,
          .save { grid-column: 1; }
          .support-card a { width: 100%; }
        }
      `}</style>
    </div>
  );
}
