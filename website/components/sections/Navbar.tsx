import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useState } from "react";

import { palette } from "@/lib/theme";

const links = [
  { href: "#workflow", label: "Workflow" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Features" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (value) => {
    setScrolled(value > 24);
  });

  return (
    <motion.header
      className="nav"
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: scrolled ? "rgba(255,255,255,0.82)" : "transparent",
        borderBottomColor: scrolled ? palette.slate200 : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
      }}
    >
      <a href="#" className="brand">
        <span className="brand-mark">A</span>
        <span>Auditur</span>
      </a>

      <nav className="nav-links">
        {links.map((link, index) => (
          <motion.a
            key={link.href}
            href={link.href}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + index * 0.06 }}
            whileHover={{ color: palette.teal600 }}
          >
            {link.label}
          </motion.a>
        ))}
      </nav>

      <motion.a
        href="/login/?next=%2Fdashboard%2F"
        className="nav-cta"
        whileHover={{ scale: 1.03, y: -1 }}
        whileTap={{ scale: 0.98 }}
      >
        Manager sign in
      </motion.a>

      <style>{`
        .nav {
          position: sticky;
          top: 0;
          z-index: 50;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          padding: 1rem clamp(1.25rem, 4vw, 3rem);
          border-bottom: 1px solid transparent;
          transition: background 0.25s ease, border-color 0.25s ease;
        }

        .brand {
          display: inline-flex;
          align-items: center;
          gap: 0.65rem;
          font-weight: 800;
          font-size: 1.1rem;
          letter-spacing: -0.02em;
        }

        .brand-mark {
          width: 2rem;
          height: 2rem;
          border-radius: 0.65rem;
          display: grid;
          place-items: center;
          background: linear-gradient(145deg, ${palette.teal600}, ${palette.teal800});
          color: white;
          font-weight: 800;
          box-shadow: 0 8px 20px rgba(13, 148, 136, 0.28);
        }

        .nav-links {
          display: none;
          gap: 1.5rem;
        }

        .nav-links a {
          color: ${palette.slate500};
          font-size: 0.92rem;
          font-weight: 600;
          transition: color 0.2s ease;
        }

        .nav-cta {
          padding: 0.6rem 1.1rem;
          border-radius: 999px;
          background: ${palette.teal600};
          color: white;
          font-size: 0.88rem;
          font-weight: 700;
          box-shadow: 0 10px 24px rgba(13, 148, 136, 0.25);
        }

        @media (min-width: 768px) {
          .nav-links {
            display: flex;
          }
        }
      `}</style>
    </motion.header>
  );
}
