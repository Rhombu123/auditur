"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DrawTool, LotMapApi } from "@/components/tarmac/LotMapClient";
import { brushStrokeToPolygon } from "@/lib/brush-polygon";
import {
  type LockedLotView,
  loadLockedLotView,
  saveLockedLotView,
} from "@/lib/lot-map-view";
import type { LotZone } from "@/lib/types";
import { tarmac } from "@/lib/tarmac-theme";
import {
  ZONE_COLOR_OPTIONS,
  createLotZone,
  deleteLotZone,
  fetchScannedVehicles,
  fetchZones,
  updateLotZoneColors,
  type ScannedVehicleRow,
} from "@/lib/web-api";

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
  focusZoneId?: string | null;
  onFocusZone?: (zoneId: string) => void;
};

type Point = { latitude: number; longitude: number };

export function MapPanel({ onChanged, focusZoneId = null, onFocusZone }: Props) {
  const [zones, setZones] = useState<LotZone[]>([]);
  const [vehicles, setVehicles] = useState<ScannedVehicleRow[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>("paint");
  const [draft, setDraft] = useState<Point[]>([]);
  const [zoneName, setZoneName] = useState("");
  const [colorIndex, setColorIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vinQuery, setVinQuery] = useState("");
  const [lockedView, setLockedView] = useState<LockedLotView | null>(null);
  const [relocating, setRelocating] = useState(true);
  const mapApiRef = useRef<LotMapApi | null>(null);
  const locked = Boolean(lockedView && !relocating);

  useEffect(() => {
    const saved = loadLockedLotView();
    setLockedView(saved);
    setRelocating(!saved);
  }, []);

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

  function handleLockArea() {
    const view = mapApiRef.current?.captureView();
    if (!view) {
      setError("Map is still loading — try again in a moment.");
      return;
    }
    if (view.zoom < 15) {
      setError("Zoom in closer to the lot before locking this area.");
      return;
    }
    saveLockedLotView(view);
    setLockedView(view);
    setRelocating(false);
    setDrawing(false);
    setDraft([]);
    setError(null);
  }

  function handleChangePlacement() {
    setRelocating(true);
    setError(null);
  }

  async function handleSaveZone() {
    setBusy(true);
    setError(null);
    try {
      if (draft.length < 2) throw new Error("Paint a stroke for this section before saving.");
      const polygon = brushStrokeToPolygon(draft, 12);
      if (polygon.length < 3) throw new Error("Stroke was too short — paint a longer path.");
      await createLotZone({
        name: zoneName.trim() || "Untitled zone",
        coordinates: polygon,
        colorIndex,
      });
      setDraft([]);
      setDrawing(false);
      setDrawTool("paint");
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

  function handleSearchVin() {
    const found = mapApiRef.current?.focusVin(vinQuery);
    if (!found) {
      setError("No vehicle matched that VIN (try last 6, last 8, or full VIN).");
      return;
    }
    setError(null);
  }

  return (
    <div className="panel">
      {!locked ? (
        <div className="hero">
          <div>
            <h2>Lot map</h2>
            <p>
              Highlight sections at 25% opacity, erase mistakes, then save. Search by VIN to jump to a
              pin. Lock the camera when the lot is framed.
            </p>
          </div>
          <div className="hero-actions">
            {!drawing ? (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setDrawing(true);
                  setDrawTool("paint");
                }}
              >
                Paint section
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy || draft.length < 2}
                  className="primary"
                  onClick={() => void handleSaveZone()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => {
                    setDraft([]);
                    setDrawing(false);
                    setDrawTool("paint");
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="paint-bar">
          <span className="hint">Camera locked — paint sections on this view.</span>
          <div className="hero-actions">
            {!drawing ? (
              <button
                type="button"
                className="primary"
                onClick={() => {
                  setDrawing(true);
                  setDrawTool("paint");
                }}
              >
                Paint section
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy || draft.length < 2}
                  className="primary"
                  onClick={() => void handleSaveZone()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => {
                    setDraft([]);
                    setDrawing(false);
                    setDrawTool("paint");
                  }}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="search-bar">
        <input
          value={vinQuery}
          onChange={(e) => setVinQuery(e.target.value)}
          placeholder="Search VIN (last 6, last 8, or full)"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearchVin();
          }}
        />
        <button type="button" className="primary" onClick={handleSearchVin}>
          Find
        </button>
      </div>

      <div className={relocating ? "lock-bar active" : "lock-bar"}>
        {relocating ? (
          <>
            <span className="hint">
              Frame your lot, then lock. Pan and zoom stay free until then.
            </span>
            <button type="button" className="primary" onClick={handleLockArea}>
              Lock this area
            </button>
          </>
        ) : (
          <>
            <span className="hint">Lot camera locked — pan, zoom, and rotate are off.</span>
            <button type="button" className="ghost" onClick={handleChangePlacement}>
              Change placement
            </button>
          </>
        )}
      </div>

      {drawing ? (
        <div className="draw-bar">
          <input
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            placeholder="Section name (Front Row, Online…)"
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
          <button
            type="button"
            className={drawTool === "paint" ? "tool active" : "tool"}
            onClick={() => setDrawTool("paint")}
          >
            Highlighter
          </button>
          <button
            type="button"
            className={drawTool === "erase" ? "tool active" : "tool"}
            onClick={() => setDrawTool("erase")}
          >
            Eraser
          </button>
          <button type="button" className="ghost" onClick={() => setDraft([])}>
            Clear stroke
          </button>
        </div>
      ) : null}

      {error ? <p className="err">{error}</p> : null}

      <div className="map-shell">
        <LotMapClient
          key="lot-map"
          zones={zones}
          vehicles={vehicles}
          draft={draft}
          drawing={drawing}
          drawTool={drawTool}
          brushColor={ZONE_COLOR_OPTIONS[colorIndex % ZONE_COLOR_OPTIONS.length].stroke}
          focusZoneId={focusZoneId}
          lockedView={lockedView}
          relocating={relocating}
          onDraftChange={setDraft}
          onApiReady={(api) => {
            mapApiRef.current = api;
          }}
        />
      </div>

      <div className="zone-list">
        {zones.length === 0 ? (
          <p className="empty">No sections yet — paint one on the map.</p>
        ) : (
          zones.map((zone) => (
            <div
              key={zone.id}
              className={focusZoneId === zone.id ? "zone-row selected" : "zone-row"}
            >
              <button
                type="button"
                className="zone-main"
                onClick={() => onFocusZone?.(zone.id)}
              >
                <strong style={{ color: zone.strokeColor }}>{zone.name}</strong>
                <span>
                  {zone.polygons.length} shape
                  {zone.polygons.length === 1 ? "" : "s"} · colored section on map
                </span>
              </button>
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
        .panel { position: relative; z-index: 1; padding-top: 0.35rem; }
        .hero {
          display:flex; flex-wrap:wrap; justify-content:space-between; gap:1.1rem;
          margin-bottom:1rem; padding:1.15rem 1.2rem; border:1px solid ${tarmac.line};
          border-radius:10px; background:${tarmac.asphaltCard};
        }
        h2 { margin:0; font-size:1.05rem; }
        .hero p { margin:0.4rem 0 0; color:${tarmac.slate}; font-size:0.86rem; max-width:40rem; line-height:1.45; }
        .hero-actions, .zone-actions { display:flex; gap:0.55rem; align-items:center; flex-wrap:wrap; }
        .primary {
          border:none; border-radius:999px; padding:0.7rem 1rem;
          background:${tarmac.teal}; color:#042f2e; font-weight:800; cursor:pointer;
        }
        .primary:disabled { opacity:0.5; cursor:not-allowed; }
        .ghost, .danger, .tool {
          border:1px solid ${tarmac.line}; background:transparent; color:${tarmac.text};
          border-radius:999px; padding:0.6rem 0.85rem; font-weight:700; cursor:pointer;
        }
        .tool.active {
          border-color: ${tarmac.teal};
          color: ${tarmac.teal};
          background: rgba(13,148,136,0.12);
        }
        .danger { color:${tarmac.danger}; border-color:rgba(248,113,113,0.45); }
        .search-bar, .lock-bar, .draw-bar, .paint-bar {
          display:flex; flex-wrap:wrap; gap:0.75rem; align-items:center;
          margin-bottom:1rem; padding:0.85rem 1rem; border-radius:10px;
          border:1px solid ${tarmac.line}; background:${tarmac.asphaltCard};
        }
        .search-bar input, .draw-bar input {
          flex:1; min-width:200px; padding:0.6rem 0.75rem; border-radius:8px;
          border:1px solid ${tarmac.line}; background:#0b1220; color:${tarmac.text};
        }
        .lock-bar.active, .draw-bar {
          border-style: dashed; border-color: ${tarmac.teal};
          background:rgba(13,148,136,0.08);
        }
        .swatches { display:flex; gap:0.35rem; flex-wrap:wrap; }
        .swatches.compact { gap:0.25rem; }
        .swatch {
          width:18px; height:18px; border-radius:999px; border:2px solid transparent;
          cursor:pointer; padding:0;
        }
        .swatch.active { border-color:#ecfdf5; box-shadow:0 0 0 2px ${tarmac.teal}; }
        .hint { color:${tarmac.slate}; font-size:0.78rem; flex:1; min-width:220px; line-height:1.4; }
        .map-shell {
          height: min(64vh, 600px); min-height: 380px;
          border:1px solid ${tarmac.line}; border-radius:10px; overflow:hidden;
          margin-bottom:1.1rem; background:${tarmac.asphaltCard};
        }
        .zone-list { display:grid; gap:0.65rem; }
        .zone-row {
          display:flex; justify-content:space-between; gap:1rem; flex-wrap:wrap;
          padding:0.95rem 1.05rem; border:1px solid ${tarmac.lineDim}; border-radius:10px;
          background:${tarmac.asphaltCard};
        }
        .zone-row.selected { border-color: ${tarmac.teal}; box-shadow: inset 0 0 0 1px rgba(13,148,136,0.28); }
        .zone-main {
          border: none; background: transparent; color: inherit; font: inherit;
          text-align: left; cursor: pointer; padding: 0;
        }
        .zone-row strong { display:block; }
        .zone-row span, .empty, .err { color:#cbd5e1; font-size:0.8rem; }
        .err { color:${tarmac.danger}; margin-bottom:0.75rem; }
      `}</style>
    </div>
  );
}
