"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";

import "./auth.css";

type Props = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

const perks = [
  "Live scan feed from the lot",
  "Daily audit completion tracking",
  "Section-by-section breakdown",
];

export function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <div className="auth-page">
      <motion.aside
        className="auth-hero"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        <div className="auth-hero-inner">
          <Link href="/" className="auth-logo">
            <span className="auth-logo-mark">A</span>
            Auditur
          </Link>
          <h1>Your lot, in real time.</h1>
          <p className="auth-hero-lead">
            The manager dashboard mirrors every scan, upload, and audit your team
            runs on their phones — no spreadsheets required.
          </p>
          <ul style={{ margin: "1.25rem 0 0", padding: 0, listStyle: "none" }}>
            {perks.map((perk, i) => (
              <motion.li
                key={perk}
                className="auth-preview-row"
                style={{ marginBottom: "0.55rem" }}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.08 }}
              >
                <span className="auth-preview-dot" />
                {perk}
              </motion.li>
            ))}
          </ul>
        </div>

        <motion.div
          className="auth-preview-stack"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.55 }}
        >
          <div className="auth-preview-card">
            <strong>87%</strong>
            <span>Audit complete today</span>
          </div>
          <div className="auth-preview-card">
            <div className="auth-preview-row">
              <span className="auth-preview-dot" />
              4S4BSAKC scanned · Online section
            </div>
          </div>
        </motion.div>
      </motion.aside>

      <div className="auth-panel-wrap">
        <motion.div
          className="auth-panel"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <Link href="/" className="auth-back">
            ← Back to home
          </Link>
          <h2>{title}</h2>
          <p className="auth-panel-sub">{subtitle}</p>
          {children}
          <div className="auth-footer">{footer}</div>
        </motion.div>
      </div>
    </div>
  );
}

export function AuthLoading() {
  return (
    <div className="auth-loading">
      <div className="auth-spinner" />
      <span>Loading…</span>
    </div>
  );
}
