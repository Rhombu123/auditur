"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { AuditDial } from "@/components/tarmac/AuditDial";
import { AuditPanel } from "@/components/tarmac/AuditPanel";
import { MapPanel } from "@/components/tarmac/MapPanel";
import { MissingMarquee } from "@/components/tarmac/MissingMarquee";
import { ScanFeed } from "@/components/tarmac/ScanFeed";
import { UploadPanel } from "@/components/tarmac/UploadPanel";
import { UploadStrip } from "@/components/tarmac/UploadStrip";
import { VehiclesPanel } from "@/components/tarmac/VehiclesPanel";
import { ZoneBays } from "@/components/tarmac/ZoneBays";
import { displayName, useAuth } from "@/lib/auth-context";
import { tarmac } from "@/lib/tarmac-theme";
import type { DashboardData } from "@/lib/types";
import { useDashboardRealtime } from "@/lib/use-dashboard-realtime";
import { fetchDashboardData } from "@/lib/web-api";
import { supabaseConfigured } from "@/lib/supabase-browser";

type TabId = "overview" | "audit" | "upload" | "vehicles" | "map";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "audit", label: "Audit" },
  { id: "upload", label: "Uploads" },
  { id: "vehicles", label: "Vehicles" },
  { id: "map", label: "Map" },
];

export function TarmacDashboard() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
    } else {
      setSyncing(true);
    }
    setError(null);
    if (!supabaseConfigured()) {
      setError(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel.",
      );
      setLoading(false);
      setSyncing(false);
      return;
    }
    try {
      setData(await fetchDashboardData());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load dashboard.");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useDashboardRealtime({
    enabled: supabaseConfigured(),
    onChange: () => void load({ silent: true }),
  });

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  const refresh = useCallback(async () => {
    await load({ silent: true });
  }, [load]);

  const audit = data?.audit;
  const today = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="deck">
      <div className="grid-bg" aria-hidden />
      <header className="command-bar">
        <div>
          <span className="deck-tag">Tarmac · Mission control</span>
          <h1>LOT STATUS</h1>
          <p>{today}</p>
        </div>
        <div className="command-right">
          <div className="manager">
            <span className="mgr-label">Manager</span>
            <strong>{displayName(user)}</strong>
          </div>
          {syncing ? <span className="sync-pill">Syncing…</span> : null}
          <motion.button
            type="button"
            className="signout"
            onClick={() => void handleSignOut()}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Sign out
          </motion.button>
        </div>
      </header>

      <nav className="tabs" aria-label="Dashboard sections">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={tab === item.id ? "tab active" : "tab"}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {error ? <p className="error-banner">{error}</p> : null}

      {loading && !data ? (
        <p className="loading">Syncing field data from phones…</p>
      ) : (
        <>
          {tab === "overview" ? (
            <>
              <div className="stat-strip">
                <div>
                  <strong>{data?.totalPinnedVehicles ?? 0}</strong>
                  <span>Pinned on map</span>
                </div>
                <div>
                  <strong>{audit?.scannedNotOnListCount ?? 0}</strong>
                  <span>Not on list</span>
                </div>
                <div>
                  <strong>{data?.zoneStats.length ?? 0}</strong>
                  <span>Lot sections</span>
                </div>
              </div>

              <div className="bays">
                <AuditDial
                  percent={audit?.completionPercent ?? 0}
                  expected={audit?.expectedCount ?? 0}
                  scanned={audit?.scannedTodayCount ?? 0}
                  missing={audit?.notScannedTodayCount ?? 0}
                  fileName={audit?.inventoryFileName ?? null}
                />
                <ScanFeed scans={data?.recentScans ?? []} />
                <ZoneBays zones={data?.zoneStats ?? []} />
              </div>

              <MissingMarquee vehicles={audit?.missingToday ?? []} />
              <UploadStrip uploads={data?.uploadLog ?? []} />
            </>
          ) : null}

          {tab === "audit" && data ? (
            <AuditPanel data={data} onRefresh={refresh} />
          ) : null}

          {tab === "upload" ? (
            <UploadPanel uploads={data?.uploadLog ?? []} onChanged={refresh} />
          ) : null}

          {tab === "vehicles" ? <VehiclesPanel onChanged={refresh} /> : null}

          {tab === "map" ? <MapPanel onChanged={refresh} /> : null}
        </>
      )}

      <style jsx>{`
        .deck {
          min-height: 100vh;
          background: ${tarmac.asphalt};
          color: ${tarmac.text};
          padding: 1.25rem clamp(1rem, 3vw, 2rem) 3rem;
          position: relative;
        }

        .grid-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(${tarmac.lineDim} 1px, transparent 1px),
            linear-gradient(90deg, ${tarmac.lineDim} 1px, transparent 1px);
          background-size: 64px 64px;
          opacity: 0.35;
        }

        .command-bar {
          position: relative;
          z-index: 1;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 1rem;
          padding-bottom: 1.25rem;
          margin-bottom: 0.85rem;
          border-bottom: 1px solid ${tarmac.line};
        }

        .deck-tag {
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${tarmac.teal};
        }

        h1 {
          margin: 0.35rem 0 0;
          font-family: var(--font-mono), monospace;
          font-size: clamp(1.6rem, 4vw, 2.2rem);
          letter-spacing: 0.12em;
          font-weight: 900;
        }

        .command-bar p {
          margin: 0.25rem 0 0;
          color: ${tarmac.slate};
          font-size: 0.88rem;
        }

        .command-right {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .manager {
          text-align: right;
        }

        .mgr-label {
          display: block;
          font-size: 0.65rem;
          color: ${tarmac.slate};
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .manager strong {
          font-size: 0.95rem;
        }

        .sync-pill {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${tarmac.teal};
          padding: 0.35rem 0.6rem;
          border: 1px solid ${tarmac.line};
          border-radius: 999px;
          animation: pulse-sync 1s ease-in-out infinite;
        }

        @keyframes pulse-sync {
          50% {
            opacity: 0.45;
          }
        }

        .signout {
          padding: 0.55rem 1rem;
          border-radius: 6px;
          border: 1px solid ${tarmac.line};
          background: ${tarmac.asphaltCard};
          color: ${tarmac.text};
          font-weight: 700;
          font-size: 0.82rem;
          cursor: pointer;
        }

        .tabs {
          position: relative;
          z-index: 1;
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-bottom: 1.1rem;
        }

        .tab {
          border: 1px solid ${tarmac.line};
          background: transparent;
          color: ${tarmac.slate};
          border-radius: 999px;
          padding: 0.45rem 0.9rem;
          font-size: 0.8rem;
          font-weight: 700;
          cursor: pointer;
        }

        .tab.active {
          color: ${tarmac.teal};
          border-color: ${tarmac.teal};
          background: rgba(13, 148, 136, 0.12);
        }

        .error-banner {
          background: rgba(248, 113, 113, 0.12);
          border: 1px solid rgba(248, 113, 113, 0.35);
          color: ${tarmac.danger};
          padding: 0.75rem 1rem;
          border-radius: 6px;
          margin-bottom: 1rem;
        }

        .loading {
          color: ${tarmac.slate};
          font-size: 0.9rem;
        }

        .stat-strip {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.65rem;
          margin-bottom: 1rem;
        }

        .stat-strip div {
          padding: 0.85rem;
          background: ${tarmac.asphaltCard};
          border: 1px solid ${tarmac.lineDim};
          border-radius: 6px;
          text-align: center;
        }

        .stat-strip strong {
          display: block;
          font-family: var(--font-mono), monospace;
          font-size: 1.35rem;
        }

        .stat-strip span {
          font-size: 0.68rem;
          color: ${tarmac.slate};
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .bays {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        @media (min-width: 1024px) {
          .bays {
            grid-template-columns: 280px 1fr 260px;
            align-items: start;
          }
        }
      `}</style>
    </div>
  );
}
