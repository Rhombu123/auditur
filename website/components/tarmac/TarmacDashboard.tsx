"use client";

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
import "@/components/tarmac/dashboard.css";
import { displayName, useAuth } from "@/lib/auth-context";
import { isDemoLotEnabled, resetDemoLot } from "@/lib/demo-store";
import {
  loadSelectedUploadId,
  saveSelectedUploadId,
} from "@/lib/selected-upload";
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

const TITLES: Record<TabId, { title: string; blurb: string }> = {
  overview: {
    title: "Lot overview",
    blurb: "Completion, live scans, and section activity for the selected price list.",
  },
  audit: {
    title: "Audit",
    blurb: "Missing, off-list, and scanned vehicles for today’s walk.",
  },
  upload: {
    title: "Uploads",
    blurb: "Manage price-list PDFs and switch which list drives the audit.",
  },
  vehicles: {
    title: "Vehicles",
    blurb: "Edit scanned records and browse inventory from the active list.",
  },
  map: {
    title: "Lot map",
    blurb: "Lock the camera, paint sections, and find units by VIN.",
  },
  members: {
    title: "Members",
    blurb: "Invite employees by Auditur ID and manage roles.",
  },
};

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
  const page = TITLES[tab];

  return (
    <div className="desk">
      <aside className="desk-sidebar">
        <div className="desk-brand">
          <span className="desk-brand-mark">A</span>
          <div className="desk-brand-copy">
            <strong>Auditur</strong>
            <span>Lot desk</span>
          </div>
        </div>
        <nav className="desk-nav" aria-label="Dashboard sections">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? "desk-nav-btn active" : "desk-nav-btn"}
              onClick={() => setTab(item.id)}
            >
              <span className="desk-nav-dot" aria-hidden />
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="desk-main">
        <header className="desk-topbar">
          <div>
            <h1>{page.title}</h1>
            <p>
              {today} · {page.blurb}
            </p>
          </div>
          <div className="desk-top-actions">
            <div className="desk-user">
              <span>{isAdminBypass ? "Admin" : "Signed in"}</span>
              <strong>{displayName(user)}</strong>
            </div>
            {syncing ? <span className="desk-sync">Syncing…</span> : null}
            <button type="button" className="ui-btn ui-btn-secondary" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </div>
        </header>

        <div className="desk-body">
          {demoMode ? (
            <div className="desk-banner">
              <div>
                <strong>Demo lot loaded</strong>
                <span>
                  Sample inventory, scans, and zones. Edits stay in this browser so you can explore.
                </span>
              </div>
              <button
                type="button"
                className="ui-btn ui-btn-secondary"
                onClick={() => {
                  resetDemoLot();
                  void load({ uploadId: null });
                }}
              >
                Reset demo
              </button>
            </div>
          ) : null}

          {error ? <p className="desk-error">{error}</p> : null}

          {loading && !data ? (
            <p className="desk-loading">Loading lot data…</p>
          ) : (
            <>
              {tab === "overview" ? (
                <>
                  <div className="desk-kpis">
                    <div className="desk-kpi">
                      <strong>{data?.totalPinnedVehicles ?? 0}</strong>
                      <span>Pinned on map</span>
                    </div>
                    <div className="desk-kpi">
                      <strong>{audit?.scannedNotOnListCount ?? 0}</strong>
                      <span>Not on list</span>
                    </div>
                    <div className="desk-kpi">
                      <strong>{data?.zoneStats.length ?? 0}</strong>
                      <span>Lot sections</span>
                    </div>
                  </div>

                  <div className="desk-grid">
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

              {tab === "audit" && data ? <AuditPanel data={data} onRefresh={refresh} /> : null}

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
        </div>
      </div>
    </div>
  );
}
