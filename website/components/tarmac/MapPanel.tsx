"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";

import {
  ZONE_COLOR_OPTIONS,
  createLotZone,
  deleteLotZone,
  fetchScannedVehicles,
  fetchZones,
  updateLotZoneColors,
  type ScannedVehicleRow,
} from "@/lib/web-api";
import type { LotZone } from "@/lib/types";
import { tarmac } from "@/lib/tarmac-theme";

const LotMapClient = dynamic(() => import("@/components/tarmac/LotMapClient"), {
  ssr: false,
  loading: () => (
    <p style={{ margin: 0, display: "grid", placeItems: "center", height: "100%", color: "#94a3b8" }}>
      Loading map…
    </p>
  ),
});

type Props = {
  onChanged: () => Promise<void>;
};

type Point = { latitude: number; longitude: number };

export function MapPanel({ onChanged }: Props) {
  const [zones, setZones] = useState<LotZone[]>([]);
  const [vehicles, setVehicles] = useState<ScannedVehicleRow[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState<Point[]>([]);
  const [zoneName, setZoneName] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const [nextZones, nextVehicles] = await Promise.all([fetchZones(), fetchScannedVehicles()]);
    setZones(nextZones);
    setVehicles(nextVehicles);
  }, []);

  useEffect(() => {
    void reload().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load map data.");
    });
  }, [reload]);

  async function afterMutation() {
    await reload();
    await onChanged();
  }

  async function handleSaveZone() {
    setBusy(true);
    setError(null);
    try {
      await createLotZone({
        name: zoneName.trim() || "Untitled zone",
        coordinates: draft,
        colorIndex,
      });
      setDraft([]);
      setDrawing(false);
      setZoneName("");
      await afterMutation();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save zone.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteZone(id: string, name: string) {
    if (!window.confirm(`Delete zone “${name}”?`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteLotZone(id);
      await afterMutation();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete zone.");
    } finally {
      setBusy(false);
    }
  }

  async function handleColor(zone: LotZone, index: number) {
    const colors = ZONE_COLOR_OPTIONS[index % ZONE_COLOR_OPTIONS.length];
    setBusy(true);
    setError(null);
    try {
      await updateLotZoneColors(zone.id, {
        fillColor: colors.fill,
        strokeColor: colors.stroke,
      });
      await afterMutation();
    } catch (colorError) {
      setError(colorError instanceof Error ? colorError.message : "Could not update color.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="hero">
        <div>
          <h2>Lot map</h2>
          <p>
            View phone scan pins and manage zones. Drawing a zone with the same name adds another
            polygon to it. Scan / camera capture stays on the phone.
          </p>
        </div>
        <div className="hero-actions">
          {!drawing ? (
            <button type="button" className="primary" onClick={() => setDrawing(true)}>
              Draw zone
            </button>
          ) : (
            <>
              <button
                type="button"
                disabled={busy || draft.length < 3}
                className="primary"
                onClick={() => void handleSaveZone()}
              >
                Save ({draft.length} pts)
              </button>
              <button
                type="button"
                className="ghost"
                disabled={busy}
                onClick={() => {
                  setDraft([]);
                  setDrawing(false);
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>

      {drawing ? (
        <div className="draw-bar">
          <input
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            placeholder="Zone name (reuse to merge polygons)"
          />
          <div className="swatches">
            {ZONE_COLOR_OPTIONS.map((color, index) => (
              <button
                key={color.id}
                type="button"
                title={color.label}
                className={colorIndex === index ? "swatch active" : "swatch"}
                style={{ background: color.stroke }}
                onClick={() => setColorIndex(index)}
              />
            ))}
          </div>
          <button type="button" className="ghost" onClick={() => setDraft([])}>
            Clear points
          </button>
          <span className="hint">Click the map to place corners (3+).</span>
        </div>
      ) : null}

      {error ? <p className="err">{error}</p> : null}

      <div className="map-shell">
        <LotMapClient
          zones={zones}
          vehicles={vehicles}
          draft={draft}
          drawing={drawing}
          onMapClick={(point) => setDraft((prev) => [...prev, point])}
        />
      </div>

      <div className="zone-list">
        {zones.length === 0 ? (
          <p className="empty">No zones yet — draw one on the map.</p>
        ) : (
          zones.map((zone) => (
            <div key={zone.id} className="zone-row">
              <div>
                <strong style={{ color: zone.strokeColor }}>{zone.name}</strong>
                <span>
                  {zone.polygons.length} polygon
                  {zone.polygons.length === 1 ? "" : "s"} ·{" "}
                  {zone.polygons.reduce((n, p) => n + p.length, 0)} corners
                </span>
              </div>
              <div className="zone-actions">
                <div className="swatches compact">
                  {ZONE_COLOR_OPTIONS.map((color, index) => (
                    <button
                      key={color.id}
                      type="button"
                      title={color.label}
                      className="swatch"
                      style={{ background: color.stroke }}
                      disabled={busy}
                      onClick={() => void handleColor(zone, index)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="danger"
                  disabled={busy}
                  onClick={() => void handleDeleteZone(zone.id, zone.name)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <style jsx>{`
        .panel { position: relative; z-index: 1; }
        .hero {
          display:flex; flex-wrap:wrap; justify-content:space-between; gap:1rem;
          margin-bottom:0.85rem; padding:1rem; border:1px solid ${tarmac.line};
          border-radius:8px; background:${tarmac.asphaltCard};
        }
        h2 { margin:0; font-size:1.05rem; }
        .hero p { margin:0.35rem 0 0; color:${tarmac.slate}; font-size:0.86rem; max-width:40rem; }
        .hero-actions, .zone-actions { display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; }
        .primary {
          border:none; border-radius:6px; padding:0.65rem 0.95rem;
          background:${tarmac.teal}; color:#042f2e; font-weight:800; cursor:pointer;
        }
        .primary:disabled { opacity:0.5; cursor:not-allowed; }
        .ghost, .danger {
          border:1px solid ${tarmac.line}; background:transparent; color:${tarmac.text};
          border-radius:6px; padding:0.55rem 0.8rem; font-weight:700; cursor:pointer;
        }
        .danger { color:${tarmac.danger}; border-color:rgba(248,113,113,0.45); }
        .draw-bar {
          display:flex; flex-wrap:wrap; gap:0.65rem; align-items:center;
          margin-bottom:0.85rem; padding:0.75rem 0.9rem; border-radius:8px;
          border:1px dashed ${tarmac.line}; background:rgba(13,148,136,0.08);
        }
        .draw-bar input {
          flex:1; min-width:200px; padding:0.55rem 0.7rem; border-radius:6px;
          border:1px solid ${tarmac.line}; background:#0b1220; color:${tarmac.text};
        }
        .swatches { display:flex; gap:0.35rem; flex-wrap:wrap; }
        .swatches.compact { gap:0.25rem; }
        .swatch {
          width:18px; height:18px; border-radius:999px; border:2px solid transparent;
          cursor:pointer; padding:0;
        }
        .swatch.active { border-color:#ecfdf5; box-shadow:0 0 0 2px ${tarmac.teal}; }
        .hint { color:${tarmac.slate}; font-size:0.78rem; }
        .map-shell {
          height: min(62vh, 560px); min-height: 360px;
          border:1px solid ${tarmac.line}; border-radius:8px; overflow:hidden;
          margin-bottom:0.85rem; background:${tarmac.asphaltCard};
        }
        .map-shell :global(.map-loading) {
          display:grid; place-items:center; height:100%; color:${tarmac.slate}; margin:0;
        }
        .zone-list { display:grid; gap:0.5rem; }
        .zone-row {
          display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap;
          padding:0.8rem 0.95rem; border:1px solid ${tarmac.lineDim}; border-radius:6px;
          background:${tarmac.asphaltCard};
        }
        .zone-row strong { display:block; }
        .zone-row span, .empty, .err { color:${tarmac.slate}; font-size:0.78rem; }
        .err { color:${tarmac.danger}; margin-bottom:0.65rem; }
      `}</style>
    </div>
  );
}
