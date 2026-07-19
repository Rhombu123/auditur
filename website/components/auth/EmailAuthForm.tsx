"use client";

import { useState } from "react";

import {
  TurnstileWidget,
  turnstileConfigured,
} from "@/components/auth/TurnstileWidget";
import "./auth.css";

export type AccountType = "owner_gm" | "employee";

export type SignupPayload = {
  fullName: string;
  accountType: AccountType;
};

type Props = {
  mode: "login" | "signup";
  onSubmit: (
    email: string,
    password: string,
    signup?: SignupPayload,
    captchaToken?: string,
  ) => Promise<void>;
};

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h16v16H4z" stroke="none" />
      <path d="M4 7l8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="4" y="5" width="16" height="14" rx="2" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c1.5-4 12.5-4 14 0" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" strokeLinecap="round" />
    </svg>
  );
}

function EyeIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.5" />
      {hidden ? <path d="M4 4l16 16" strokeLinecap="round" /> : null}
    </svg>
  );
}

export function EmailAuthForm({ mode, onSubmit }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaAttempt, setCaptchaAttempt] = useState(0);

  async function handleSubmit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!fullName.trim()) throw new Error("Enter your name.");
        if (!accountType) throw new Error("Choose whether you are an owner/GM or an employee.");
        await onSubmit(
          email,
          password,
          { fullName, accountType },
          captchaToken ?? undefined,
        );
      } else {
        await onSubmit(email, password, undefined, captchaToken ?? undefined);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Authentication failed.");
    } finally {
      setCaptchaToken(null);
      setCaptchaAttempt((value) => value + 1);
      setLoading(false);
    }
  }

  const canSubmit =
    email.includes("@") &&
    (mode === "login" || password.length >= 12) &&
    (process.env.NODE_ENV === "development"
      ? !turnstileConfigured || Boolean(captchaToken)
      : turnstileConfigured && Boolean(captchaToken)) &&
    (mode === "login" || (Boolean(fullName.trim()) && accountType !== null));

  return (
    <div>
      <div>
            {mode === "signup" ? (
              <>
                <div className="auth-field">
                  <label htmlFor="name">Full name</label>
                  <div className="auth-input-wrap">
                    <UserIcon />
                    <input
                      id="name"
                      className="auth-input"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Jordan Lee"
                      autoComplete="name"
                    />
                  </div>
                </div>

                <fieldset className="auth-role-fieldset">
                  <legend>How will you use Auditur?</legend>
                  <div className="auth-role-options">
                    <label
                      className={
                        accountType === "owner_gm" ? "auth-role-card selected" : "auth-role-card"
                      }
                    >
                      <input
                        type="radio"
                        name="accountType"
                        value="owner_gm"
                        checked={accountType === "owner_gm"}
                        onChange={() => setAccountType("owner_gm")}
                      />
                      <span className="auth-role-title">Dealership owner / GM</span>
                      <span className="auth-role-copy">
                        Manage the lot, invite employees by their Auditur ID, and own the dashboard.
                      </span>
                    </label>
                    <label
                      className={
                        accountType === "employee" ? "auth-role-card selected" : "auth-role-card"
                      }
                    >
                      <input
                        type="radio"
                        name="accountType"
                        value="employee"
                        checked={accountType === "employee"}
                        onChange={() => setAccountType("employee")}
                      />
                      <span className="auth-role-title">Dealership employee</span>
                      <span className="auth-role-copy">
                        Get a unique 9-digit Auditur ID your owner or GM can add to their member list.
                      </span>
                    </label>
                  </div>
                </fieldset>
              </>
            ) : null}

            <div className="auth-field">
              <label htmlFor="email">Work email</label>
              <div className="auth-input-wrap">
                <MailIcon />
                <input
                  id="email"
                  className="auth-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@dealership.com"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <div className="auth-input-wrap">
                <LockIcon />
                <input
                  id="password"
                  className="auth-input auth-password-input"
                  type={passwordVisible ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={
                    mode === "signup"
                      ? "12+ chars, mixed case, number, symbol"
                      : "Password"
                  }
                  minLength={mode === "signup" ? 12 : 1}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                />
                <button
                  type="button"
                  className="auth-password-toggle"
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  aria-label={passwordVisible ? "Hide password" : "Show password"}
                >
                  <EyeIcon hidden={passwordVisible} />
                </button>
              </div>
            </div>

            <TurnstileWidget key={captchaAttempt} onToken={setCaptchaToken} />

            <button
              type="button"
              className="auth-btn"
              disabled={loading || !canSubmit}
              onClick={() => void handleSubmit()}
            >
              {loading
                ? mode === "signup"
                  ? "Creating account…"
                  : "Signing in…"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </button>
      </div>

      {error ? <p className="auth-error">{error}</p> : null}
    </div>
  );
}
