"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { OtpInput } from "@/components/auth/OtpInput";
import "./auth.css";

type Step = "form" | "code";

type Props = {
  mode: "login" | "signup";
  onSendCode: (email: string) => Promise<void>;
  onVerify: (email: string, code: string, fullName?: string) => Promise<void>;
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

export function EmailOtpForm({ mode, onSendCode, onVerify }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup" && !fullName.trim()) {
        throw new Error("Enter your name.");
      }
      await onSendCode(email);
      setStep("code");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send code.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setError(null);
    setLoading(true);
    try {
      await onVerify(email, code, mode === "signup" ? fullName : undefined);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <AnimatePresence mode="wait">
        {step === "form" ? (
          <motion.div
            key="form"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
          >
            {mode === "signup" ? (
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

            <button
              type="button"
              className="auth-btn"
              disabled={loading || !email.includes("@")}
              onClick={() => void handleSend()}
            >
              {loading ? "Sending code…" : "Continue with email"}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="code"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
          >
            <p className="auth-hint">
              Enter the 6-digit code we sent to <strong>{email}</strong>
            </p>

            <div className="auth-field">
              <label>Verification code</label>
              <OtpInput value={code} onChange={setCode} disabled={loading} />
            </div>

            <button
              type="button"
              className="auth-btn"
              disabled={loading || code.length < 6}
              onClick={() => void handleVerify()}
            >
              {loading
                ? "Verifying…"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in to dashboard"}
            </button>

            <button
              type="button"
              className="auth-link-btn"
              onClick={() => void handleSend()}
              disabled={loading}
            >
              Resend code
            </button>
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => {
                setStep("form");
                setCode("");
                setError(null);
              }}
            >
              Use a different email
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {error ? <p className="auth-error">{error}</p> : null}
    </div>
  );
}
