import { motion } from "framer-motion";

import { palette } from "../theme";

export function Footer() {
  return (
    <motion.footer
      className="footer"
      initial={{ opacity: 0 }}
      whileInView={{ opacity: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
    >
      <div className="footer-inner">
        <div className="brand">
          <span className="brand-mark">A</span>
          <div>
            <strong>Auditur</strong>
            <p>Dealership lot auditing, simplified.</p>
          </div>
        </div>

        <div className="links">
          <a href="#workflow">Workflow</a>
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
        </div>
      </div>

      <p className="copy">
        © {new Date().getFullYear()} Auditur. Built for inventory teams who need
        proof, not guesses.
      </p>

      <style>{`
        .footer {
          position: relative;
          z-index: 1;
          padding: 2.5rem clamp(1.25rem, 4vw, 3rem) 2rem;
          border-top: 1px solid ${palette.slate200};
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(8px);
        }

        .footer-inner {
          max-width: 1080px;
          margin: 0 auto 1.5rem;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 1.5rem;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .brand-mark {
          width: 2.25rem;
          height: 2.25rem;
          border-radius: 0.7rem;
          display: grid;
          place-items: center;
          background: linear-gradient(145deg, ${palette.teal600}, ${palette.teal800});
          color: white;
          font-weight: 800;
        }

        .brand strong {
          display: block;
          font-size: 1rem;
        }

        .brand p {
          margin: 0.1rem 0 0;
          font-size: 0.82rem;
          color: ${palette.slate500};
        }

        .links {
          display: flex;
          flex-wrap: wrap;
          gap: 1.25rem;
        }

        .links a {
          color: ${palette.slate500};
          font-size: 0.88rem;
          font-weight: 600;
          transition: color 0.2s ease;
        }

        .links a:hover {
          color: ${palette.teal600};
        }

        .copy {
          max-width: 1080px;
          margin: 0 auto;
          font-size: 0.78rem;
          color: ${palette.slate400};
          text-align: center;
        }
      `}</style>
    </motion.footer>
  );
}
