import { motion, useInView } from "framer-motion";
import { useRef } from "react";

import { fadeUp, palette, stagger } from "../theme";

export function Workflow() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="workflow" className="section" ref={ref}>
      <motion.div
        className="section-inner"
        variants={stagger}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
      >
        <motion.span className="section-label" variants={fadeUp}>
          One-sentence workflow
        </motion.span>
        <motion.h2 variants={fadeUp}>
          Upload your price list, scan every VIN on the lot, and close the audit
          before you leave.
        </motion.h2>
        <motion.p className="section-lead" variants={fadeUp}>
          No clipboards. No guessing which row a car is in. Auditur is built for
          managers who need a fast, defensible count at the end of every day.
        </motion.p>

        <motion.div className="quote-card" variants={fadeUp}>
          <motion.div
            className="quote-pulse"
            animate={{ scale: [1, 1.15, 1], opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
          <p>
            &ldquo;We upload the morning price list, walk the lot with our phones,
            and know exactly what&apos;s missing before the lot closes.&rdquo;
          </p>
          <span>— The workflow Auditur is designed around</span>
        </motion.div>
      </motion.div>

      <style>{`
        .section {
          padding: clamp(3rem, 7vw, 5rem) clamp(1.25rem, 4vw, 3rem);
        }

        .section-inner {
          max-width: 820px;
          margin: 0 auto;
          text-align: center;
        }

        .section-label {
          display: inline-block;
          margin-bottom: 0.75rem;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${palette.teal700};
        }

        h2 {
          margin: 0 0 1rem;
          font-size: clamp(1.65rem, 3.5vw, 2.35rem);
          line-height: 1.2;
          letter-spacing: -0.025em;
          font-weight: 800;
        }

        .section-lead {
          margin: 0 auto;
          max-width: 38rem;
          color: ${palette.slate500};
          line-height: 1.65;
          font-size: 1.02rem;
        }

        .quote-card {
          position: relative;
          margin-top: 2rem;
          padding: 1.5rem 1.35rem;
          border-radius: 1.25rem;
          background: white;
          border: 1px solid ${palette.teal200};
          box-shadow: 0 16px 40px rgba(13, 148, 136, 0.08);
          text-align: left;
          overflow: hidden;
        }

        .quote-pulse {
          position: absolute;
          top: 1rem;
          left: 1rem;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: ${palette.teal600};
        }

        .quote-card p {
          margin: 0 0 0.65rem;
          padding-left: 1.25rem;
          font-size: 1.05rem;
          line-height: 1.6;
          font-weight: 600;
          color: ${palette.slate700};
        }

        .quote-card span {
          padding-left: 1.25rem;
          font-size: 0.82rem;
          color: ${palette.slate500};
        }
      `}</style>
    </section>
  );
}
