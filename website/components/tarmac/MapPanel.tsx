"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";

import type { DrawTool, LotMapApi } from "@/components/tarmac/LotMapClient";
import { brushStrokeToPolygon } from "@/lib/brush-polygon";
import { hexToRgba } from "@/lib/color";
import {
  type LockedLotView,
  loadLockedLotView,
  saveLockedLotView,
} from "@/lib/lot-map-view";
import type { LotZone } from "@/lib/types";
import { tarmac } from "@/lib/tarmac-theme";
import {
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

const DEFAULT_BRUSH = "#0D9488";

export function MapPanel({ onChanged, focusZoneId = null, onFocusZone }: Props) {
  const [zones, setZones] = useState<LotZone[]>([]);
  const [vehicles, setVehicles] = useState<ScannedVehicleRow[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [drawTool, setDrawTool] = useState<DrawTool>("paint");
  const [draft, setDraft] = useState<Point[]>([]);
  const [zoneName, setZoneName] = useState("");
  const [brushHex, setBrushHex] = useState(DEFAULT_BRUSH);
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
        strokeColor: brushHex,
        fillColor: hexToRgba(brushHex, 0.35),
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

  async function handleZoneColor(zone: LotZone, hex: string) {
    setBusy(true);
    setError(null);
    try {
      await updateLotZoneColors(zone.id, {
        fillColor: hexToRgba(hex, 0.35),
        strokeColor: hex,
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

  const paintActions = !drawing ? (
    <button
      type="button"
      className="ui-btn ui-btn-primary"
      onClick={() => {
        setDrawing(true);
        setDrawTool("paint");
      }}
    >
      Paint section
    </button>
  ) : (
    <div className="btn-row">
      <button
        type="button"
        disabled={busy || draft.length < 2}
        className="ui-btn ui-btn-primary"
        onClick={() => void handleSaveZone()}
      >
        Save
      </button>
      <button
        type="button"
        className="ui-btn ui-btn-secondary"
        disabled={busy}
        onClick={() => {
          setDraft([]);
          setDrawing(false);
          setDrawTool("paint");
        }}
      >
        Cancel
      </button>
    </div>
  );

  return (
    <div className="panel">
      {!locked ? (
        <div className="desk-panel-hero">
          <div>
            <h2>Sections & camera</h2>
            <p>
              Highlight at 50% opacity, erase mistakes, then save. Lock the camera when the lot is
              framed.
            </p>
          </div>
          {paintActions}
        </div>
      ) : (
        <div className="desk-toolbar">
          <span className="desk-hint">Camera locked — paint sections on this view.</span>
          {paintActions}
        </div>
      )}

      <div className="desk-toolbar">
        <input
          className="desk-input"
          value={vinQuery}
          onChange={(e) => setVinQuery(e.target.value)}
          placeholder="Search VIN (last 6, last 8, or full)"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearchVin();
          }}
        />
        <button type="button" className="ui-btn ui-btn-primary" onClick={handleSearchVin}>
          Find
        </button>
      </div>

      <div className={`desk-toolbar ${relocating ? "accent" : ""}`}>
        {relocating ? (
          <>
            <span className="desk-hint">Frame your lot, then lock. Pan and zoom stay free until then.</span>
            <button type="button" className="ui-btn ui-btn-primary" onClick={handleLockArea}>
              Lock this area
            </button>
          </>
        ) : (
          <>
            <span className="desk-hint">Lot camera locked — pan, zoom, and rotate are off.</span>
            <button type="button" className="ui-btn ui-btn-secondary" onClick={handleChangePlacement}>
              Change placement
            </button>
          </>
        )}
      </div>

      {drawing ? (
        <div className="desk-toolbar accent">
          <input
            className="desk-input"
            value={zoneName}
            onChange={(e) => setZoneName(e.target.value)}
            placeholder="Section name (Front Row, Online…)"
          />
          <label className="color-field" title="Section color">
            <span>Color</span>
            <input
              type="color"
              value={brushHex}
              onChange={(e) => setBrushHex(e.target.value)}
              aria-label="Section color"
            />
          </label>
          <button
            type="button"
            className={drawTool === "paint" ? "ui-btn ui-btn-tool active" : "ui-btn ui-btn-tool"}
            onClick={() => setDrawTool("paint")}
          >
            Highlighter
          </button>
          <button
            type="button"
            className={drawTool === "erase" ? "ui-btn ui-btn-tool active" : "ui-btn ui-btn-tool"}
            onClick={() => setDrawTool("erase")}
          >
            Eraser
          </button>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={() => setDraft([])}>
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
          brushColor={brushHex}
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
              <div className="btn-row">
                <label className="color-field compact" title="Change color">
                  <input
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(zone.strokeColor) ? zone.strokeColor : DEFAULT_BRUSH}
                    disabled={busy}
                    onChange={(e) => void handleZoneColor(zone, e.target.value)}
                    aria-label={`Color for ${zone.name}`}
                  />
                </label>
                <button
                  type="button"
                  className="ui-btn ui-btn-danger"
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
        .btn-row { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
        .desk-toolbar.accent {
          border-color: #b6e8e1;
          background: ${tarmac.tealSoft};
        }
        .color-field {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          height: 36px;
          padding: 0 0.7rem;
          border-radius: 8px;
          border: 1px solid ${tarmac.line};
          background: ${tarmac.surface};
          color: ${tarmac.slate};
          font-size: 0.7rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          cursor: pointer;
        }
        .color-field.compact { padding: 0 0.45rem; }
        .color-field input[type="color"] {
          width: 1.35rem;
          height: 1.35rem;
          padding: 0;
          border: none;
          background: transparent;
          cursor: pointer;
        }
        .map-shell {
          height: min(64vh, 600px);
          min-height: 380px;
          border: 1px solid ${tarmac.lineDim};
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 1rem;
          background: ${tarmac.ink};
        }
        .zone-list { display: grid; gap: 0.55rem; }
        .zone-row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          padding: 0.9rem 1rem;
          border: 1px solid ${tarmac.lineDim};
          border-radius: 10px;
          background: ${tarmac.surface};
        }
        .zone-row.selected {
          border-color: #99e6dc;
          box-shadow: inset 0 0 0 1px rgba(13, 148, 136, 0.18);
        }
        .zone-main {
          border: none;
          background: transparent;
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
          padding: 0;
        }
        .zone-row strong { display: block; font-size: 0.92rem; }
        .zone-row span, .empty { color: ${tarmac.slate}; font-size: 0.8rem; }
        .err { color: ${tarmac.danger}; margin: 0 0 0.75rem; font-size: 0.86rem; }
      `}</style>
    </div>
  );
}
