import { motion, useInView } from "framer-motion";
import { useRef } from "react";

import { fadeUp, palette, stagger } from "../theme";

const steps = [
  {
    number: "01",
    title: "Upload your price list",
    description:
      "Drop in your dealership PDF. Auditur extracts VIN6, model, color, and days on lot — no manual entry.",
    icon: "📄",
    color: palette.teal600,
  },
  {
    number: "02",
    title: "Scan VINs on the lot",
    description:
      "Walk the lot with your phone. Every barcode scan captures GPS so each vehicle is pinned where you found it.",
    icon: "📷",
    color: palette.amber500,
  },
  {
    number: "03",
    title: "Audit & export",
    description:
      "See what's missing, what's extra, and which section each car belongs to. Export a highlighted PDF for your records.",
    icon: "✓",
    color: "#3B82F6",
  },
];

export function HowItWorks() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="how-it-works" className="section" ref={ref}>
      <motion.div
        className="header"
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.55 }}
      >
        <span className="section-label">How it works</span>
        <h2>Three steps from PDF to proof</h2>
        <p>Built for field use — big tap targets, fast scans, clear audit status.</p>
      </motion.div>

      <motion.div
        className="steps"
        variants={stagger}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
      >
        {steps.map((step, index) => (
          <motion.article
            key={step.number}
            className="step-card"
            variants={fadeUp}
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
          >
            <motion.div
              className="step-icon"
              style={{ background: `${step.color}18`, borderColor: `${step.color}40` }}
              initial={{ rotate: -8, scale: 0.9 }}
              animate={inView ? { rotate: 0, scale: 1 } : {}}
              transition={{ delay: 0.15 + index * 0.12, type: "spring", stiffness: 200 }}
            >
              {step.icon}
            </motion.div>
            <span className="step-num" style={{ color: step.color }}>
              {step.number}
            </span>
            <h3>{step.title}</h3>
            <p>{step.description}</p>
            {index < steps.length - 1 ? (
              <motion.div
                className="connector"
                initial={{ scaleX: 0 }}
                animate={inView ? { scaleX: 1 } : {}}
                transition={{ delay: 0.4 + index * 0.15, duration: 0.5 }}
              />
            ) : null}
          </motion.article>
        ))}
      </motion.div>

      <style>{`
        .section {
          padding: clamp(3rem, 7vw, 5rem) clamp(1.25rem, 4vw, 3rem);
          background: linear-gradient(180deg, transparent, rgba(240, 253, 250, 0.65));
        }

        .header {
          max-width: 640px;
          margin: 0 auto 2.5rem;
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

        .header h2 {
          margin: 0 0 0.65rem;
          font-size: clamp(1.65rem, 3.5vw, 2.2rem);
          letter-spacing: -0.025em;
          font-weight: 800;
        }

        .header p {
          margin: 0;
          color: ${palette.slate500};
          line-height: 1.6;
        }

        .steps {
          max-width: 1080px;
          margin: 0 auto;
          display: grid;
          gap: 1.25rem;
        }

        .step-card {
          position: relative;
          background: white;
          border: 1px solid ${palette.slate200};
          border-radius: 1.25rem;
          padding: 1.5rem;
          box-shadow: 0 12px 30px rgba(15, 23, 42, 0.05);
        }

        .step-icon {
          width: 3rem;
          height: 3rem;
          border-radius: 0.9rem;
          border: 1px solid;
          display: grid;
          place-items: center;
          font-size: 1.35rem;
          margin-bottom: 1rem;
        }

        .step-num {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.75rem;
          font-weight: 700;
          letter-spacing: 0.08em;
        }

        .step-card h3 {
          margin: 0.35rem 0 0.5rem;
          font-size: 1.15rem;
          font-weight: 800;
        }

        .step-card p {
          margin: 0;
          color: ${palette.slate500};
          line-height: 1.6;
          font-size: 0.95rem;
        }

        .connector {
          display: none;
        }

        @media (min-width: 900px) {
          .steps {
            grid-template-columns: repeat(3, 1fr);
          }

          .connector {
            display: block;
            position: absolute;
            top: 2.4rem;
            right: -0.65rem;
            width: 1.3rem;
            height: 2px;
            background: ${palette.slate200};
            transform-origin: left;
            z-index: 2;
          }
        }
      `}</style>
    </section>
  );
}
