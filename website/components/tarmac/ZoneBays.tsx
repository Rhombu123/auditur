"use client";

import { motion } from "framer-motion";

import { motionEase, tarmac } from "@/lib/tarmac-theme";
import type { ZoneStat } from "@/lib/types";

export function ZoneBays({ zones }: { zones: ZoneStat[] }) {
  return (
    <div className="zones-bay">
      <span className="bay-label">Lot sections today</span>
      {zones.length === 0 ? (
        <p className="empty">No sections drawn yet. Create zones on the Map tab in the app.</p>
      ) : (
        <div className="zone-grid">
          {zones.map((zone, index) => (
            <motion.div
              key={zone.id}
              className="zone-card"
              style={{ borderColor: zone.strokeColor }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + index * 0.07, ease: motionEase }}
              whileHover={{ y: -3 }}
            >
              <span className="swatch" style={{ background: zone.strokeColor }} />
              <span className="name">{zone.name}</span>
              <span className="count">{zone.count}</span>
              <span className="unit">scans today</span>
            </motion.div>
          ))}
        </div>
      )}

      <style jsx>{`
        .zones-bay {
          background: ${tarmac.asphaltCard};
          border: 1px solid ${tarmac.line};
          border-radius: 8px;
          padding: 1.25rem;
        }

        .bay-label {
          display: block;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${tarmac.teal};
          margin-bottom: 1rem;
        }

        .zone-grid {
          display: grid;
          gap: 0.65rem;
        }

        .zone-card {
          display: grid;
          grid-template-columns: auto 1fr auto;
          grid-template-rows: auto auto;
          gap: 0.15rem 0.65rem;
          align-items: center;
          padding: 0.85rem 1rem;
          background: ${tarmac.asphaltLight};
          border-radius: 6px;
          border-left: 4px solid;
        }

        .swatch {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          grid-row: span 2;
        }

        .name {
          font-weight: 700;
          color: ${tarmac.text};
          font-size: 0.92rem;
        }

        .count {
          font-family: var(--font-mono), monospace;
          font-size: 1.35rem;
          font-weight: 800;
          color: ${tarmac.text};
          grid-row: span 2;
        }

        .unit {
          font-size: 0.68rem;
          color: ${tarmac.slate};
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .empty {
          color: ${tarmac.slate};
          font-size: 0.88rem;
          line-height: 1.5;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
