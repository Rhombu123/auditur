"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { AuditDial } from "@/components/tarmac/AuditDial";
import { AuditPanel } from "@/components/tarmac/AuditPanel";
import { MapPanel } from "@/components/tarmac/MapPanel";
import { MembersPanel } from "@/components/tarmac/MembersPanel";
import { ProfilePanel } from "@/components/tarmac/ProfilePanel";
import { ScanFeed } from "@/components/tarmac/ScanFeed";
import { SettingsPanel } from "@/components/tarmac/SettingsPanel";
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

type TabId =
  | "overview"
  | "audit"
  | "upload"
  | "vehicles"
  | "map"
  | "members"
  | "profile"
  | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "audit", label: "Audit" },
  { id: "upload", label: "Uploads" },
  { id: "vehicles", label: "Vehicles" },
  { id: "map", label: "Map" },
  { id: "members", label: "Members" },
];

function IconGear() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M19.4 13a7.7 7.7 0 0 0 .05-2l2.05-1.6-2-3.46-2.45.9a7.6 7.6 0 0 0-1.73-1L14.8 3h-5.6l-.52 2.24a7.6 7.6 0 0 0-1.73 1l-2.45-.9-2 3.46L4.55 11a7.7 7.7 0 0 0 0 2l-2.05 1.6 2 3.46 2.45-.9a7.6 7.6 0 0 0 1.73 1L9.2 21h5.6l.52-2.24a7.6 7.6 0 0 0 1.73-1l2.45.9 2-3.46L19.4 13Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconProfile() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19.25c1.4-3.2 11.6-3.2 13 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden>
      <path
        d="M10 5.5H7.5A2.5 2.5 0 0 0 5 8v8a2.5 2.5 0 0 0 2.5 2.5H10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M14 8.5 18.5 12 14 15.5M18 12H10"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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
  profile: {
    title: "Profile",
    blurb: "Your account details and Auditur ID.",
  },
  settings: {
    title: "Settings",
    blurb: "Desk preferences for this browser.",
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
        <nav className="desk-nav-foot" aria-label="Account">
          <button
            type="button"
            className={tab === "settings" ? "desk-icon-btn active" : "desk-icon-btn"}
            aria-label="Settings"
            title="Settings"
            onClick={() => setTab("settings")}
          >
            <IconGear />
          </button>
          <button
            type="button"
            className={tab === "profile" ? "desk-icon-btn active" : "desk-icon-btn"}
            aria-label="Profile"
            title="Profile"
            onClick={() => setTab("profile")}
          >
            <IconProfile />
          </button>
          <button
            type="button"
            className="desk-icon-btn desk-icon-btn-exit"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void handleSignOut()}
          >
            <IconSignOut />
          </button>
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

          {tab === "profile" ? <ProfilePanel /> : null}
          {tab === "settings" ? (
            <SettingsPanel
              onDemoReset={() => {
                void load({ uploadId: null });
              }}
            />
          ) : null}

          {loading && !data && tab !== "profile" && tab !== "settings" ? (
            <p className="desk-loading">Loading lot data…</p>
          ) : tab !== "profile" && tab !== "settings" ? (
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
          ) : null}
        </div>
      </div>
    </div>
  );
}
