"use client";

import { useEffect, useState } from "react";

import { displayName, useAuth } from "@/lib/auth-context";
import { useDealership } from "@/lib/dealership-context";
import { supabase } from "@/lib/supabase-browser";
import { tarmac } from "@/lib/tarmac-theme";

type Profile = {
  fullName: string;
  email: string;
  accountType: "owner_gm" | "employee";
  auditurId: string | null;
};

export function ProfilePanel() {
  const { user, isAdminBypass } = useAuth();
  const { activeDealership } = useDealership();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (isAdminBypass) {
      const next: Profile = {
        fullName: "Admin",
        email: user.email ?? "admin@auditur.app",
        accountType: "owner_gm",
        auditurId: null,
      };
      setProfile(next);
      setFullName(next.fullName);
      return;
    }
    void supabase
      .from("profiles")
      .select("full_name, account_type, auditur_id")
      .eq("user_id", user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setMessage(error?.message ?? "Could not load profile.");
          return;
        }
        const next: Profile = {
          fullName: data.full_name,
          email: user.email ?? "—",
          accountType: data.account_type,
          auditurId: data.auditur_id,
        };
        setProfile(next);
        setFullName(next.fullName);
      });
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
          },
        });
        if (error) throw error;
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ full_name: fullName.trim() })
          .eq("user_id", user?.id);
        if (profileError) throw profileError;
      }
      setProfile((current) =>
        current ? { ...current, fullName: fullName.trim() } : current,
      );
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
          <div className="read-only">
            <span className="k">Active dealership</span>
            <strong>{activeDealership?.dealershipName ?? "Not assigned"}</strong>
          </div>
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
