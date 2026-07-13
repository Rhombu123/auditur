"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import "./auth.css";

type Step = "form" | "sent";

type Props = {
  mode: "login" | "signup";
  onSendLink: (email: string, fullName?: string) => Promise<void>;
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

export function EmailAuthForm({ mode, onSendLink }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setError(null);
    setLoading(true);
    try {
      if (mode === "signup" && !fullName.trim()) {
        throw new Error("Enter your name.");
      }
      await onSendLink(email, mode === "signup" ? fullName : undefined);
      setStep("sent");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send email.");
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
              {loading ? "Sending…" : "Continue with email"}
            </button>
          </motion.div>
        ) : (
          <motion.div
            key="sent"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
          >
            <p className="auth-hint">
              Check <strong>{email}</strong> and open the <strong>magic link</strong> in
              that email. It verifies your sign-in and brings you back to where you left off.
            </p>

            <button
              type="button"
              className="auth-btn"
              onClick={() => void handleSend()}
              disabled={loading}
            >
              {loading ? "Sending…" : "Resend magic link"}
            </button>
            <button
              type="button"
              className="auth-link-btn"
              onClick={() => {
                setStep("form");
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
