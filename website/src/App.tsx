import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

import { palette } from "./theme";
import { Features } from "./sections/Features";
import { Footer } from "./sections/Footer";
import { Hero } from "./sections/Hero";
import { HowItWorks } from "./sections/HowItWorks";
import { Navbar } from "./sections/Navbar";
import { Workflow } from "./sections/Workflow";

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const glowY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);

  return (
    <div ref={containerRef} className="page">
      <motion.div
        className="bg-glow bg-glow--teal"
        style={{ y: glowY }}
        aria-hidden
      />
      <motion.div
        className="bg-glow bg-glow--amber"
        style={{ y: useTransform(scrollYProgress, [0, 1], ["10%", "50%"]) }}
        aria-hidden
      />

      <Navbar />

      <main>
        <Hero />
        <Workflow />
        <HowItWorks />
        <Features />
      </main>

      <Footer />

      <style>{`
        .page {
          position: relative;
          overflow-x: hidden;
        }

        .bg-glow {
          position: fixed;
          width: 520px;
          height: 520px;
          border-radius: 50%;
          filter: blur(90px);
          opacity: 0.45;
          pointer-events: none;
          z-index: 0;
        }

        .bg-glow--teal {
          top: -120px;
          right: -80px;
          background: radial-gradient(circle, ${palette.teal200} 0%, transparent 70%);
        }

        .bg-glow--amber {
          bottom: 10%;
          left: -120px;
          background: radial-gradient(circle, rgba(245, 158, 11, 0.25) 0%, transparent 70%);
        }

        main {
          position: relative;
          z-index: 1;
        }
      `}</style>
    </div>
  );
}
