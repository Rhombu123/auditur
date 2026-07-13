"use client";

import { AnimatePresence, motion } from "framer-motion";

import { motionEase, tarmac } from "@/lib/tarmac-theme";
import type { ScanFeedItem } from "@/lib/types";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function ScanFeed({ scans }: { scans: ScanFeedItem[] }) {
  return (
    <div className="feed-bay">
      <div className="feed-head">
        <span className="bay-label">Live scan feed</span>
        <span className="live-dot" />
        <span className="live-text">From phones</span>
      </div>

      <div className="feed-list">
        <AnimatePresence initial={false}>
          {scans.length === 0 ? (
            <p className="empty">No scans yet today. Open Auditur on your phone and start walking the lot.</p>
          ) : (
            scans.map((scan, index) => (
              <motion.div
                key={scan.id}
                className="feed-row"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04, ease: motionEase }}
              >
                <div className="row-main">
                  <span className="vin">{scan.vinSuffix}</span>
                  <span className="model">{scan.model}</span>
                </div>
                <div className="row-meta">
                  {scan.zoneName ? (
                    <span className="zone">{scan.zoneName}</span>
                  ) : (
                    <span className="zone off-lot">Off section</span>
                  )}
                  <span className="time">{formatTime(scan.scannedAt)}</span>
                  {!scan.matched ? <span className="flag">Not on list</span> : null}
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        .feed-bay {
          background: ${tarmac.asphaltCard};
          border: 1px solid ${tarmac.line};
          border-radius: 8px;
          padding: 1.25rem;
          min-height: 320px;
          display: flex;
          flex-direction: column;
        }

        .feed-head {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .bay-label {
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${tarmac.teal};
        }

        .live-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: ${tarmac.success};
          box-shadow: 0 0 10px ${tarmac.tealGlow};
          animation: blink 1.4s ease-in-out infinite;
        }

        @keyframes blink {
          50% {
            opacity: 0.35;
          }
        }

        .live-text {
          font-size: 0.72rem;
          color: ${tarmac.slate};
          font-weight: 600;
        }

        .feed-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 380px;
        }

        .feed-row {
          padding: 0.75rem 0.85rem;
          border-left: 3px solid ${tarmac.teal};
          background: ${tarmac.asphaltLight};
          border-radius: 0 6px 6px 0;
        }

        .row-main {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: baseline;
        }

        .vin {
          font-family: var(--font-mono), monospace;
          font-weight: 700;
          font-size: 0.95rem;
          color: ${tarmac.text};
          letter-spacing: 0.08em;
        }

        .model {
          font-size: 0.85rem;
          color: ${tarmac.slate};
        }

        .row-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 0.35rem;
          font-size: 0.72rem;
        }

        .zone {
          color: ${tarmac.teal};
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .zone.off-lot {
          color: ${tarmac.slateDim};
        }

        .time {
          color: ${tarmac.slateDim};
        }

        .flag {
          color: ${tarmac.amber};
          font-weight: 700;
        }

        .empty {
          color: ${tarmac.slate};
          font-size: 0.9rem;
          line-height: 1.55;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
