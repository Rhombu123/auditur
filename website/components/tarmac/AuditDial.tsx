"use client";

import { motion } from "framer-motion";

import { motionEase, tarmac } from "@/lib/tarmac-theme";

type Props = {
  percent: number;
  expected: number;
  scanned: number;
  missing: number;
  fileName: string | null;
};

export function AuditDial({ percent, expected, scanned, missing, fileName }: Props) {
  const radius = 88;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <motion.div
      className="dial-bay"
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: motionEase }}
    >
      <span className="bay-label">Today&apos;s audit</span>
      <div className="dial-wrap">
        <svg viewBox="0 0 200 200" className="dial-svg" aria-hidden>
          <circle cx="100" cy="100" r={radius} className="track" />
          <motion.circle
            cx="100"
            cy="100"
            r={radius}
            className="progress"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: motionEase, delay: 0.2 }}
          />
        </svg>
        <div className="dial-center">
          <motion.span
            className="pct"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            {clamped}%
          </motion.span>
          <span className="pct-label">complete</span>
        </div>
      </div>
      <div className="dial-stats">
        <div>
          <strong>{expected}</strong>
          <span>Expected</span>
        </div>
        <div>
          <strong>{scanned}</strong>
          <span>Scanned</span>
        </div>
        <div className={missing > 0 ? "warn" : ""}>
          <strong>{missing}</strong>
          <span>Remaining</span>
        </div>
      </div>
      {fileName ? (
        <p className="file">
          <span className="file-label">Price list</span>
          {fileName}
        </p>
      ) : (
        <p className="file muted">No price list selected</p>
      )}

      <style jsx>{`
        .dial-bay {
          background: ${tarmac.surface};
          border: 1px solid ${tarmac.lineDim};
          border-radius: 10px;
          padding: 1.25rem;
          position: relative;
          overflow: hidden;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .dial-bay::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: linear-gradient(90deg, ${tarmac.teal}, ${tarmac.amber});
        }

        .bay-label {
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${tarmac.tealDeep};
        }

        .dial-wrap {
          position: relative;
          width: min(100%, 220px);
          margin: 1rem auto;
        }

        .dial-svg {
          width: 100%;
          transform: rotate(-90deg);
        }

        .dial-svg :global(.track) {
          fill: none;
          stroke: ${tarmac.line};
          stroke-width: 12;
        }

        .dial-svg :global(.progress) {
          fill: none;
          stroke: ${tarmac.teal};
          stroke-width: 12;
          stroke-linecap: round;
        }

        .dial-center {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .pct {
          font-size: 2.4rem;
          font-weight: 800;
          color: ${tarmac.text};
          line-height: 1;
          letter-spacing: -0.04em;
        }

        .pct-label {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${tarmac.slate};
          margin-top: 0.25rem;
        }

        .dial-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
          text-align: center;
        }

        .dial-stats strong {
          display: block;
          font-size: 1.25rem;
          color: ${tarmac.text};
          letter-spacing: -0.02em;
        }

        .dial-stats span {
          font-size: 0.68rem;
          color: ${tarmac.slate};
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .dial-stats :global(.warn) strong {
          color: ${tarmac.amber};
        }

        .file {
          margin: 0.95rem 0 0;
          font-size: 0.8rem;
          color: ${tarmac.text};
          text-align: center;
          line-height: 1.35;
          word-break: break-word;
        }

        .file-label {
          display: block;
          margin-bottom: 0.2rem;
          font-size: 0.65rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${tarmac.tealDeep};
          font-weight: 700;
        }

        .file.muted {
          color: ${tarmac.slate};
        }
      `}</style>
    </motion.div>
  );
}
