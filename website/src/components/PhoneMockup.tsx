import { motion } from "framer-motion";

import { palette } from "../theme";

const screens = [
  {
    tab: "Upload",
    title: "Price list PDF",
    lines: ["247 vehicles parsed", "VIN6 · model · color", "Days on lot"],
    accent: palette.teal600,
  },
  {
    tab: "Scan",
    title: "Scanning VIN…",
    lines: ["Barcode detected", "GPS: 41.8781° N", "Matched to inventory"],
    accent: palette.amber500,
  },
  {
    tab: "Map",
    title: "Lot overview",
    lines: ["Online · 12 units", "Front row · 8 units", "3 missing today"],
    accent: "#3B82F6",
  },
];

export function PhoneMockup() {
  return (
    <div className="phone-wrap">
      <motion.div
        className="phone-glow"
        animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.75, 0.5] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        className="phone"
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="phone-tabs">
            {screens.map((screen, index) => (
              <motion.span
                key={screen.tab}
                className={index === 1 ? "active" : ""}
                animate={index === 1 ? { scale: [1, 1.05, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {screen.tab}
              </motion.span>
            ))}
          </div>

          <motion.div
            className="phone-card"
            key="scan"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="scan-frame">
              <motion.div
                className="scan-line"
                animate={{ top: ["12%", "78%", "12%"] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              />
              <span className="vin">4S4BSAKC</span>
            </div>
            <p className="card-title">{screens[1].title}</p>
            {screens[1].lines.map((line, i) => (
              <motion.p
                key={line}
                className="card-line"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.15 }}
              >
                {line}
              </motion.p>
            ))}
          </motion.div>

          <div className="phone-pills">
            {["Online", "Front", "Service"].map((zone, i) => (
              <motion.span
                key={zone}
                className="pill"
                style={{
                  borderColor: [palette.teal600, "#3B82F6", palette.amber500][i],
                  color: [palette.teal700, "#1D4ED8", "#B45309"][i],
                }}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1 + i * 0.1 }}
              >
                <i style={{ background: [palette.teal600, "#3B82F6", palette.amber500][i] }} />
                {zone}
              </motion.span>
            ))}
          </div>
        </div>
      </motion.div>

      <motion.div
        className="float-card float-card--left"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0, y: [0, -6, 0] }}
        transition={{
          opacity: { delay: 0.6 },
          x: { delay: 0.6 },
          y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay: 0.6 },
        }}
      >
        <strong>87%</strong>
        <span>Audit complete</span>
      </motion.div>

      <motion.div
        className="float-card float-card--right"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0, y: [0, 8, 0] }}
        transition={{
          opacity: { delay: 0.8 },
          x: { delay: 0.8 },
          y: { duration: 4.5, repeat: Infinity, ease: "easeInOut", delay: 0.8 },
        }}
      >
        <strong>12</strong>
        <span>Missing today</span>
      </motion.div>

      <style>{`
        .phone-wrap {
          position: relative;
          width: min(100%, 320px);
          margin: 0 auto;
        }

        .phone-glow {
          position: absolute;
          inset: 10% 5%;
          background: radial-gradient(circle, rgba(13, 148, 136, 0.35), transparent 70%);
          filter: blur(18px);
          z-index: 0;
        }

        .phone {
          position: relative;
          z-index: 1;
          border-radius: 2.2rem;
          padding: 0.65rem;
          background: linear-gradient(160deg, #1e293b, #0f172a);
          box-shadow:
            0 30px 60px rgba(15, 23, 42, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .phone-notch {
          width: 34%;
          height: 1.1rem;
          margin: 0.15rem auto 0.55rem;
          border-radius: 999px;
          background: #020617;
        }

        .phone-screen {
          border-radius: 1.6rem;
          background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%);
          padding: 1rem;
          min-height: 420px;
          overflow: hidden;
        }

        .phone-tabs {
          display: flex;
          justify-content: space-around;
          margin-bottom: 1rem;
          font-size: 0.72rem;
          font-weight: 700;
          color: ${palette.slate400};
        }

        .phone-tabs .active {
          color: ${palette.teal600};
        }

        .phone-card {
          background: white;
          border: 1px solid ${palette.slate200};
          border-radius: 1.1rem;
          padding: 1rem;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        }

        .scan-frame {
          position: relative;
          height: 110px;
          border-radius: 0.85rem;
          background: #0f172a;
          display: grid;
          place-items: center;
          overflow: hidden;
          margin-bottom: 0.85rem;
        }

        .scan-line {
          position: absolute;
          left: 8%;
          right: 8%;
          height: 2px;
          background: linear-gradient(90deg, transparent, ${palette.teal600}, transparent);
          box-shadow: 0 0 12px ${palette.teal600};
        }

        .vin {
          font-family: "JetBrains Mono", monospace;
          font-size: 0.95rem;
          font-weight: 600;
          letter-spacing: 0.12em;
          color: #e2e8f0;
        }

        .card-title {
          margin: 0 0 0.35rem;
          font-weight: 800;
          font-size: 0.95rem;
        }

        .card-line {
          margin: 0.15rem 0 0;
          font-size: 0.78rem;
          color: ${palette.slate500};
        }

        .phone-pills {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-top: 1rem;
        }

        .pill {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.6rem;
          border-radius: 999px;
          border: 1px solid;
          background: white;
          font-size: 0.68rem;
          font-weight: 700;
        }

        .pill i {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
        }

        .float-card {
          position: absolute;
          z-index: 2;
          padding: 0.75rem 0.9rem;
          border-radius: 1rem;
          background: rgba(255, 255, 255, 0.92);
          border: 1px solid ${palette.slate200};
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
          backdrop-filter: blur(10px);
        }

        .float-card strong {
          display: block;
          font-size: 1.2rem;
          color: ${palette.teal700};
        }

        .float-card span {
          font-size: 0.72rem;
          color: ${palette.slate500};
          font-weight: 600;
        }

        .float-card--left {
          left: -8%;
          top: 18%;
        }

        .float-card--right {
          right: -6%;
          bottom: 16%;
        }

        @media (max-width: 959px) {
          .float-card--left { left: 0; }
          .float-card--right { right: 0; }
        }
      `}</style>
    </div>
  );
}
