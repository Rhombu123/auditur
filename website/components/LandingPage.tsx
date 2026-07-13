"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

import { Features } from "@/components/sections/Features";
import { Footer } from "@/components/sections/Footer";
import { Hero } from "@/components/sections/Hero";
import { HowItWorks } from "@/components/sections/HowItWorks";
import { Navbar } from "@/components/sections/Navbar";
import { Workflow } from "@/components/sections/Workflow";
import { palette } from "@/lib/theme";

export function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const glowY = useTransform(scrollYProgress, [0, 1], ["0%", "40%"]);
  const amberGlowY = useTransform(scrollYProgress, [0, 1], ["10%", "50%"]);

  return (
    <div ref={containerRef} className="page">
      <motion.div
        className="bg-glow bg-glow--teal"
        style={{ y: glowY }}
        aria-hidden
      />
      <motion.div
        className="bg-glow bg-glow--amber"
        style={{ y: amberGlowY }}
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
