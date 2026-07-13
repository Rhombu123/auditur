import { motion, useInView } from "framer-motion";
import { useRef } from "react";

import { fadeUp, palette, stagger } from "../theme";

const features = [
  {
    title: "Satellite lot map",
    description:
      "Every scan drops a pin on a live map. Filter by section, focus a vehicle, and see where it was last scanned.",
    tag: "Map",
  },
  {
    title: "Custom lot sections",
    description:
      "Draw Online, Front Row, or Service zones on satellite imagery. Color-code each section and merge boundaries easily.",
    tag: "Zones",
  },
  {
    title: "Daily audit dashboard",
    description:
      "Compare today's scans against your price list. Missing units, extras, and completion percentage at a glance.",
    tag: "Audit",
  },
  {
    title: "Highlighted PDF export",
    description:
      "Export your original price list with rows highlighted in each section's color — blue for Online, teal for Front, and so on.",
    tag: "Export",
  },
  {
    title: "Upload log & cleanup",
    description:
      "Wrong PDF? Remove it from your upload history. Keep a log of every price list you've imported.",
    tag: "Upload",
  },
  {
    title: "VIN barcode scanning",
    description:
      "Point your camera at a VIN barcode. Auditur decodes it, matches inventory, and logs GPS automatically.",
    tag: "Scan",
  },
];

export function Features() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section id="features" className="section" ref={ref}>
      <motion.div
        className="header"
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
      >
        <span className="section-label">Features</span>
        <h2>Everything you need for a clean lot count</h2>
        <p>
          Auditur is a mobile-first tool for dealership inventory teams — not another
          generic spreadsheet.
        </p>
      </motion.div>

      <motion.div
        className="grid"
        variants={stagger}
        initial="hidden"
        animate={inView ? "visible" : "hidden"}
      >
        {features.map((feature, index) => (
          <motion.article
            key={feature.title}
            className="feature-card"
            variants={fadeUp}
            whileHover={{
              y: -4,
              boxShadow: "0 20px 40px rgba(13, 148, 136, 0.12)",
            }}
          >
            <motion.span
              className="tag"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={inView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.1 + index * 0.05 }}
            >
              {feature.tag}
            </motion.span>
            <h3>{feature.title}</h3>
            <p>{feature.description}</p>
          </motion.article>
        ))}
      </motion.div>

      <motion.div
        className="cta"
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.35 }}
      >
        <h3>Ready to audit smarter?</h3>
        <p>
          Auditur runs on iOS and Android via Expo. Ask your team lead for access,
          or reach out to get your dealership set up.
        </p>
        <motion.a
          href="mailto:hello@auditur.app"
          className="cta-btn"
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.98 }}
        >
          Contact us
        </motion.a>
      </motion.div>

      <style>{`
        .section {
          padding: clamp(3rem, 7vw, 5rem) clamp(1.25rem, 4vw, 3rem);
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

        .grid {
          max-width: 1080px;
          margin: 0 auto;
          display: grid;
          gap: 1rem;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
        }

        .feature-card {
          background: white;
          border: 1px solid ${palette.slate200};
          border-radius: 1.15rem;
          padding: 1.35rem;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.04);
          transition: box-shadow 0.25s ease;
        }

        .tag {
          display: inline-block;
          padding: 0.25rem 0.55rem;
          border-radius: 999px;
          background: ${palette.teal50};
          border: 1px solid ${palette.teal200};
          color: ${palette.teal700};
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 0.75rem;
        }

        .feature-card h3 {
          margin: 0 0 0.5rem;
          font-size: 1.05rem;
          font-weight: 800;
        }

        .feature-card p {
          margin: 0;
          color: ${palette.slate500};
          line-height: 1.55;
          font-size: 0.92rem;
        }

        .cta {
          max-width: 720px;
          margin: 3rem auto 0;
          padding: 2rem 1.5rem;
          text-align: center;
          border-radius: 1.5rem;
          background: linear-gradient(145deg, ${palette.teal600}, ${palette.teal800});
          color: white;
          box-shadow: 0 24px 50px rgba(13, 148, 136, 0.3);
        }

        .cta h3 {
          margin: 0 0 0.5rem;
          font-size: clamp(1.35rem, 3vw, 1.75rem);
          font-weight: 800;
        }

        .cta p {
          margin: 0 auto 1.25rem;
          max-width: 28rem;
          opacity: 0.92;
          line-height: 1.6;
          font-size: 0.95rem;
        }

        .cta-btn {
          display: inline-flex;
          padding: 0.85rem 1.5rem;
          border-radius: 999px;
          background: white;
          color: ${palette.teal700};
          font-weight: 800;
          font-size: 0.95rem;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.15);
        }
      `}</style>
    </section>
  );
}
