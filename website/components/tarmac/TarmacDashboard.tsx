"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AuditDial } from "@/components/tarmac/AuditDial";
import { AuditPanel } from "@/components/tarmac/AuditPanel";
import { MapPanel } from "@/components/tarmac/MapPanel";
import { MembersPanel } from "@/components/tarmac/MembersPanel";
import { ScanFeed } from "@/components/tarmac/ScanFeed";
import { UploadPanel } from "@/components/tarmac/UploadPanel";
import { UploadStrip } from "@/components/tarmac/UploadStrip";
import { VehiclesPanel } from "@/components/tarmac/VehiclesPanel";
import { ZoneBays } from "@/components/tarmac/ZoneBays";
import { displayName, useAuth } from "@/lib/auth-context";
import { isDemoLotEnabled, resetDemoLot } from "@/lib/demo-store";
import {
  loadSelectedUploadId,
  saveSelectedUploadId,
} from "@/lib/selected-upload";
import { tarmac } from "@/lib/tarmac-theme";
import type { DashboardData } from "@/lib/types";
import { useDashboardRealtime } from "@/lib/use-dashboard-realtime";
import { fetchDashboardData } from "@/lib/web-api";
import { supabaseConfigured } from "@/lib/supabase-browser";

type TabId = "overview" | "audit" | "upload" | "vehicles" | "map" | "members";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "audit", label: "Audit" },
  { id: "upload", label: "Uploads" },
  { id: "vehicles", label: "Vehicles" },
  { id: "map", label: "Map" },
  { id: "members", label: "Members" },
];

export function TarmacDashboard() {
  const { user, signOut, isAdminBypass } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("overview");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [selectedUploadId, setSelectedUploadId] = useState<string | null>(null);
  const [focusZoneId, setFocusZoneId] = useState<string | null>(null);
  const selectedUploadIdRef = useRef<string | null>(null);

  useEffect(() => {
    const saved = loadSelectedUploadId();
    setSelectedUploadId(saved);
    selectedUploadIdRef.current = saved;
  }, []);

  const load = useCallback(async (options?: { silent?: boolean; uploadId?: string | null }) => {
    const silent = options?.silent ?? false;
    const uploadId =
      options?.uploadId !== undefined ? options.uploadId : selectedUploadIdRef.current;
    if (!silent) {
      setLoading(true);
    } else {
      setSyncing(true);
    }
    setError(null);
    if (!supabaseConfigured() && !isDemoLotEnabled()) {
      setError(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY on Vercel.",
      );
      setLoading(false);
      setSyncing(false);
      return;
    }
    try {
      const next = await fetchDashboardData(uploadId);
      setData(next);
      setDemoMode(isDemoLotEnabled());
      const active =
        next.uploadLog.find((u) => u.isCurrent)?.id ?? next.uploadLog[0]?.id ?? null;
      if (active && !selectedUploadIdRef.current) {
        selectedUploadIdRef.current = active;
        setSelectedUploadId(active);
        saveSelectedUploadId(active);
      }
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
    enabled: supabaseConfigured() && !isDemoLotEnabled(),
    onChange: () => void load({ silent: true }),
  });

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  const refresh = useCallback(async () => {
    await load({ silent: true });
  }, [load]);

  async function handleSelectUpload(uploadId: string) {
    selectedUploadIdRef.current = uploadId;
    setSelectedUploadId(uploadId);
    saveSelectedUploadId(uploadId);
    await load({ silent: true, uploadId });
  }

  function handleSelectZone(zoneId: string) {
    setFocusZoneId(zoneId);
    setTab("map");
  }

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
            <span className="mgr-label">{isAdminBypass ? "Admin" : "Manager"}</span>
            <strong>{displayName(user)}</strong>
          </div>
          {syncing ? <span className="sync-pill">Syncing…</span> : null}
          <motion.button
            type="button"
            className="signout"
            onClick={() => void handleSignOut()}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
          >
            Sign out
          </motion.button>
        </div>
      </header>

      {demoMode ? (
        <div className="demo-banner">
          <div>
            <strong>Demo lot loaded</strong>
            <span>
              Sample inventory, scans, and zones. Edits stay in this browser so you can poke around.
            </span>
          </div>
          <button
            type="button"
            className="demo-reset"
            onClick={() => {
              resetDemoLot();
              void load({ uploadId: null });
            }}
          >
            Reset demo
          </button>
        </div>
      ) : null}

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
                <ZoneBays
                  zones={data?.zoneStats ?? []}
                  onSelectZone={handleSelectZone}
                />
              </div>

              <UploadStrip
                uploads={data?.uploadLog ?? []}
                selectedUploadId={selectedUploadId}
                onSelect={(id) => void handleSelectUpload(id)}
              />
            </>
          ) : null}

          {tab === "audit" && data ? (
            <AuditPanel data={data} onRefresh={refresh} />
          ) : null}

          {tab === "upload" ? (
            <UploadPanel
              uploads={data?.uploadLog ?? []}
              onChanged={refresh}
              selectedUploadId={selectedUploadId}
              onSelectUpload={(id) => void handleSelectUpload(id)}
            />
          ) : null}

          {tab === "vehicles" ? <VehiclesPanel onChanged={refresh} /> : null}

          {tab === "map" ? (
            <MapPanel
              onChanged={refresh}
              focusZoneId={focusZoneId}
              onFocusZone={setFocusZoneId}
            />
          ) : null}

          {tab === "members" ? <MembersPanel /> : null}
        </>
      )}

      <style jsx>{`
        .deck {
          min-height: 100vh;
          background: ${tarmac.asphalt};
          color: ${tarmac.text};
          padding: 1.6rem clamp(1.15rem, 3.4vw, 2.4rem) 3.5rem;
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
          gap: 1.25rem;
          padding: 0.35rem 0 1.4rem;
          margin-bottom: 1.1rem;
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
          margin: 0.4rem 0 0;
          font-family: var(--font-mono), monospace;
          font-size: clamp(1.6rem, 4vw, 2.2rem);
          letter-spacing: 0.12em;
          font-weight: 900;
        }

        .command-bar p {
          margin: 0.35rem 0 0;
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
          padding-right: 0.25rem;
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
          padding: 0.4rem 0.7rem;
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
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.72rem 1.2rem;
          border-radius: 999px;
          border: 1px solid ${tarmac.line};
          background:
            linear-gradient(180deg, rgba(13, 148, 136, 0.22), rgba(13, 148, 136, 0.08)),
            ${tarmac.asphaltCard};
          color: ${tarmac.teal};
          font-weight: 800;
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          box-shadow: 0 10px 28px rgba(0, 0, 0, 0.28);
        }

        .demo-banner {
          position: relative;
          z-index: 1;
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 0.85rem;
          align-items: center;
          margin-bottom: 1.15rem;
          padding: 0.95rem 1.1rem;
          border-radius: 10px;
          border: 1px dashed ${tarmac.line};
          background: rgba(13, 148, 136, 0.1);
        }

        .demo-banner strong {
          display: block;
          color: ${tarmac.teal};
          font-size: 0.82rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .demo-banner span {
          display: block;
          margin-top: 0.2rem;
          color: ${tarmac.slate};
          font-size: 0.84rem;
          line-height: 1.4;
          max-width: 40rem;
        }

        .demo-reset {
          border: 1px solid ${tarmac.line};
          background: transparent;
          color: ${tarmac.text};
          border-radius: 8px;
          padding: 0.55rem 0.85rem;
          font-weight: 700;
          cursor: pointer;
        }

        .tabs {
          position: relative;
          z-index: 1;
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
          margin-bottom: 1.35rem;
        }

        .tab {
          border: 1px solid ${tarmac.line};
          background: transparent;
          color: ${tarmac.slate};
          border-radius: 999px;
          padding: 0.55rem 1rem;
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
          padding: 0.85rem 1.05rem;
          border-radius: 10px;
          margin-bottom: 1.15rem;
        }

        .loading {
          color: ${tarmac.slate};
          font-size: 0.9rem;
          padding: 1rem 0;
        }

        .stat-strip {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.85rem;
          margin-bottom: 1.25rem;
        }

        .stat-strip div {
          padding: 1.05rem 0.9rem;
          background: ${tarmac.asphaltCard};
          border: 1px solid ${tarmac.lineDim};
          border-radius: 10px;
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
          gap: 1.15rem;
          margin-bottom: 1.25rem;
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
