"use client";

import { motion } from "framer-motion";

import { PhoneMockup } from "@/components/PhoneMockup";
import { fadeUp, palette, stagger } from "@/lib/theme";

const stats = [
  { value: "1 PDF", label: "Upload your price list" },
  { value: "GPS", label: "Every scan is pinned" },
  { value: "100%", label: "Daily audit clarity" },
];

export function Hero() {
  return (
    <section className="hero">
      <div className="hero-grid">
        <motion.div
          className="hero-copy"
          variants={stagger}
          initial="hidden"
          animate="visible"
        >
          <motion.span className="eyebrow" variants={fadeUp}>
            Dealership lot auditing
          </motion.span>

          <motion.h1 variants={fadeUp}>
            Know exactly what&apos;s on your lot —{" "}
            <span className="gradient-text">before the day ends.</span>
          </motion.h1>

          <motion.p className="lead" variants={fadeUp}>
            Auditur turns your price list PDF into a live inventory audit. Scan VIN
            barcodes with your phone, capture GPS on every unit, and reconcile
            missing cars on a satellite map.
          </motion.p>

          <motion.div className="hero-actions" variants={fadeUp}>
            <motion.a
              href="#how-it-works"
              className="btn btn-primary"
              whileHover={{ scale: 1.03, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              How it works
            </motion.a>
            <motion.a
              href="#features"
              className="btn btn-secondary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              Explore features
            </motion.a>
          </motion.div>

          <motion.div className="hero-stats" variants={fadeUp}>
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                className="stat"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + index * 0.1 }}
              >
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, x: 40, rotate: 2 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          <PhoneMockup />
        </motion.div>
      </div>

      <style>{`
        .hero {
          padding: clamp(2.5rem, 6vw, 5rem) clamp(1.25rem, 4vw, 3rem) 3rem;
        }

        .hero-grid {
          max-width: 1120px;
          margin: 0 auto;
          display: grid;
          gap: 3rem;
          align-items: center;
        }

        .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          background: ${palette.teal50};
          border: 1px solid ${palette.teal200};
          color: ${palette.teal700};
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 1rem;
        }

        h1 {
          margin: 0 0 1rem;
          font-size: clamp(2.2rem, 5vw, 3.6rem);
          line-height: 1.08;
          letter-spacing: -0.03em;
          font-weight: 800;
        }

        .gradient-text {
          background: linear-gradient(135deg, ${palette.teal600}, ${palette.teal800});
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .lead {
          margin: 0;
          max-width: 34rem;
          font-size: 1.08rem;
          line-height: 1.65;
          color: ${palette.slate500};
        }

        .hero-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 1.75rem;
        }

        .btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.85rem 1.35rem;
          border-radius: 999px;
          font-weight: 700;
          font-size: 0.95rem;
        }

        .btn-primary {
          background: ${palette.teal600};
          color: white;
          box-shadow: 0 14px 30px rgba(13, 148, 136, 0.28);
        }

        .btn-secondary {
          background: white;
          color: ${palette.slate700};
          border: 1px solid ${palette.slate200};
        }

        .hero-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          margin-top: 2rem;
          max-width: 34rem;
        }

        .stat {
          padding: 0.85rem 0.9rem;
          border-radius: 1rem;
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid ${palette.slate200};
          backdrop-filter: blur(8px);
        }

        .stat strong {
          display: block;
          font-size: 1rem;
          font-weight: 800;
          color: ${palette.teal700};
          margin-bottom: 0.15rem;
        }

        .stat span {
          font-size: 0.75rem;
          color: ${palette.slate500};
          line-height: 1.35;
        }

        @media (min-width: 960px) {
          .hero-grid {
            grid-template-columns: 1.05fr 0.95fr;
          }

          .hero-visual {
            justify-self: end;
          }
        }
      `}</style>
    </section>
  );
}
