"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth-context";
import {
  generateMfaRecoveryCodes,
  recoverMfaWithCode,
} from "@/lib/mfa-api";
import { useMfa } from "@/lib/mfa-context";
import { supabase } from "@/lib/supabase-browser";

export function MfaGate() {
  const { signOut } = useAuth();
  const { status, factorId, error: statusError, refreshMfa } = useMfa();
  const [enrollingFactorId, setEnrollingFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");

  useEffect(() => {
    if (status !== "needs-enrollment" || enrollingFactorId) return;
    void (async () => {
      setBusy(true);
      setError(null);
      const { data: factors } = await supabase.auth.mfa.listFactors();
      for (const factor of factors?.all ?? []) {
        if (factor.status === "unverified") {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Microsoft Authenticator",
      });
      if (enrollError) {
        setError(enrollError.message);
      } else {
        setEnrollingFactorId(data.id);
        setQrCode(data.totp.qr_code);
        setSecret(data.totp.secret);
      }
      setBusy(false);
    })();
  }, [enrollingFactorId, status]);

  async function verify() {
    const target = status === "needs-enrollment" ? enrollingFactorId : factorId;
    if (!target || code.length !== 6) return;
    setBusy(true);
    setError(null);
    const { data: challenge, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId: target });
    if (challengeError) {
      setError(challengeError.message);
      setBusy(false);
      return;
    }
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: target,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      setError("That code was not accepted. Wait for a new code and try again.");
    } else {
      setCode("");
      if (status === "needs-enrollment") {
        try {
          setRecoveryCodes(await generateMfaRecoveryCodes());
        } catch (recoveryError) {
          setError(
            recoveryError instanceof Error
              ? recoveryError.message
              : "Could not generate recovery codes.",
          );
        }
      } else {
        await refreshMfa();
      }
    }
    setBusy(false);
  }

  async function recover() {
    setBusy(true);
    setError(null);
    try {
      await recoverMfaWithCode(recoveryCode);
      await signOut();
    } catch (recoveryError) {
      setError(
        recoveryError instanceof Error
          ? recoveryError.message
          : "Could not recover MFA.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return <div className="mfa-loading">Verifying account security…</div>;
  }

  const enrolling = status === "needs-enrollment";
  if (recoveryCodes) {
    return (
      <div className="mfa-page">
        <main className="mfa-card">
          <div className="mfa-icon" aria-hidden="true">⌁</div>
          <h1>Save your recovery codes</h1>
          <p>Store these safely. Each code can be used only once.</p>
          <div className="recovery-list">
            {recoveryCodes.map((value) => <code key={value}>{value}</code>)}
          </div>
          <button
            type="button"
            className="mfa-secondary"
            onClick={() => void navigator.clipboard.writeText(recoveryCodes.join("\n"))}
          >
            Copy all codes
          </button>
          <button
            type="button"
            className="mfa-primary"
            onClick={() => {
              setRecoveryCodes(null);
              void refreshMfa();
            }}
          >
            I saved these codes
          </button>
        </main>
        <GateStyles />
      </div>
    );
  }

  return (
    <div className="mfa-page">
      <main className="mfa-card">
        <div className="mfa-icon" aria-hidden="true">✓</div>
        <h1>{enrolling ? "Secure your account" : "Authenticator code"}</h1>
        <p>
          {enrolling
            ? "Open Microsoft Authenticator, add an account, and scan this QR code."
            : "Enter the current six-digit code from Microsoft Authenticator."}
        </p>
        {enrolling && qrCode ? (
          <div className="mfa-qr">
            {/* Supabase returns a trusted, generated QR data URI for this factor. */}
            <img src={qrCode} alt="Microsoft Authenticator setup QR code" />
            <small>Can&apos;t scan? Enter this setup key:</small>
            <code>{secret}</code>
          </div>
        ) : null}
        {recoveryMode ? (
          <input
            className="mfa-code recovery"
            value={recoveryCode}
            onChange={(event) => setRecoveryCode(event.target.value.toUpperCase())}
            autoComplete="off"
            placeholder="XXXX-XXXX-XXXX"
            maxLength={14}
            aria-label="Recovery code"
          />
        ) : (
          <input
            className="mfa-code"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="000000"
            maxLength={6}
            aria-label="Six-digit authenticator code"
          />
        )}
        {error || statusError ? <div className="mfa-error">{error ?? statusError}</div> : null}
        {recoveryMode ? (
          <button
            type="button"
            className="mfa-primary"
            disabled={
              busy || recoveryCode.replace(/[^A-Z0-9]/gi, "").length !== 12
            }
            onClick={() => void recover()}
          >
            {busy ? "Recovering…" : "Use recovery code"}
          </button>
        ) : (
          <button
            type="button"
            className="mfa-primary"
            disabled={busy || code.length !== 6 || (!factorId && !enrollingFactorId)}
            onClick={() => void verify()}
          >
            {busy ? "Verifying…" : enrolling ? "Enable authenticator" : "Verify code"}
          </button>
        )}
        {!enrolling ? (
          <button
            type="button"
            className="mfa-secondary"
            onClick={() => setRecoveryMode((value) => !value)}
          >
            {recoveryMode ? "Use authenticator instead" : "Use a recovery code"}
          </button>
        ) : null}
        <button type="button" className="mfa-secondary" onClick={() => void signOut()}>
          Sign out
        </button>
      </main>
      <GateStyles />
    </div>
  );
}

function GateStyles() {
  return (
    <style jsx>{`
        .mfa-page,.mfa-loading{min-height:100vh;display:grid;place-items:center;background:#f8fafc;padding:24px;color:#0f172a}
        .mfa-card{width:min(100%,440px);display:flex;flex-direction:column;align-items:center;padding:32px;border:1px solid #e2e8f0;border-radius:20px;background:#fff;box-shadow:0 20px 50px rgba(15,23,42,.08);text-align:center}
        .mfa-icon{display:grid;place-items:center;width:58px;height:58px;border-radius:18px;background:#f0fdfa;color:#0d9488;font-size:27px;font-weight:900}
        h1{margin:18px 0 6px;font-size:26px;letter-spacing:-.03em}p{margin:0;max-width:350px;color:#64748b;line-height:1.55}
        .mfa-qr{display:flex;flex-direction:column;align-items:center;margin:22px 0 4px;padding:16px;border:1px solid #e2e8f0;border-radius:16px}.mfa-qr img{width:190px;height:190px}.mfa-qr small{margin-top:12px;color:#94a3b8}.mfa-qr code{margin-top:5px;max-width:280px;overflow-wrap:anywhere;font-size:12px}
        .mfa-code{width:210px;margin-top:22px;padding:14px;border:1px solid #cbd5e1;border-radius:14px;font:700 26px/1 monospace;letter-spacing:9px;text-align:center;color:#0f172a;background:#fff}
        .mfa-code.recovery{width:260px;font-size:17px;letter-spacing:2px}
        .mfa-error{margin:12px 0;color:#dc2626;font-size:14px}.mfa-primary,.mfa-secondary{width:100%;min-height:44px;margin-top:14px;border-radius:999px;font-weight:700;cursor:pointer}.mfa-primary{border:1px solid #0d9488;background:#0d9488;color:white}.mfa-primary:disabled{opacity:.5;cursor:not-allowed}.mfa-secondary{border:1px solid #e2e8f0;background:#fff;color:#475569}
        .recovery-list{width:100%;display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:22px 0;padding:18px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc}.recovery-list code{font-size:14px}
      `}</style>
  );
}
