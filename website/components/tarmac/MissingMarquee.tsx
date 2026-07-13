"use client";

import { motion } from "framer-motion";

import { tarmac } from "@/lib/tarmac-theme";
import type { AuditVehicleRef } from "@/lib/types";

export function MissingMarquee({ vehicles }: { vehicles: AuditVehicleRef[] }) {
  if (vehicles.length === 0) {
    return (
      <div className="marquee ok">
        <span>All units on the price list were scanned today.</span>
        <style jsx>{`
          .marquee {
            padding: 0.85rem 1.25rem;
            border-radius: 8px;
            border: 1px solid ${tarmac.line};
            background: ${tarmac.asphaltCard};
            font-size: 0.88rem;
            color: ${tarmac.success};
            font-weight: 600;
          }
        `}</style>
      </div>
    );
  }

  const label = vehicles
    .slice(0, 8)
    .map((v) => `${v.vinSuffix} · ${v.model}`)
    .join("   ◆   ");

  return (
    <div className="marquee warn">
      <span className="tag">Missing today</span>
      <motion.div
        className="scroll"
        animate={{ x: ["0%", "-50%"] }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
      >
        <span>{label}   ◆   {label}</span>
      </motion.div>
      <style jsx>{`
        .marquee {
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid rgba(245, 158, 11, 0.35);
          background: rgba(245, 158, 11, 0.08);
          padding: 0.75rem 0;
        }

        .tag {
          display: block;
          padding: 0 1.25rem 0.35rem;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: ${tarmac.amber};
        }

        .scroll {
          white-space: nowrap;
          font-family: var(--font-mono), monospace;
          font-size: 0.82rem;
          color: ${tarmac.text};
        }

        .scroll span {
          padding-left: 1.25rem;
        }
      `}</style>
    </div>
  );
}
