"use client";

import { useEffect, useMemo, useState } from "react";

import {
  deleteScannedVehicleByVinSuffix,
  fetchInventoryList,
  fetchScannedVehicles,
  updateScannedVehicle,
  type ScannedVehicleRow,
} from "@/lib/web-api";
import type { InventoryItem } from "@/lib/types";
import { tarmac } from "@/lib/tarmac-theme";

type Props = {
  onChanged: () => Promise<void>;
};

export function VehiclesPanel({ onChanged }: Props) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"scanned" | "inventory">("scanned");
  const [scanned, setScanned] = useState<ScannedVehicleRow[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function reload() {
    setError(null);
    const [vehicles, inv] = await Promise.all([fetchScannedVehicles(), fetchInventoryList()]);
    setScanned(vehicles);
    setInventory(inv?.items ?? []);
    setFileName(inv?.fileName ?? null);
  }

  useEffect(() => {
    void reload().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load vehicles.");
    });
  }, []);

  const filteredScanned = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return scanned;
    return scanned.filter(
      (row) =>
        row.vinSuffix.toLowerCase().includes(q) ||
        row.model.toLowerCase().includes(q) ||
        row.color.toLowerCase().includes(q),
    );
  }, [scanned, query]);

  const filteredInventory = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (row) =>
        row.vinSuffix.toLowerCase().includes(q) ||
        row.model.toLowerCase().includes(q) ||
        row.color.toLowerCase().includes(q),
    );
  }, [inventory, query]);

  async function handleSave(row: ScannedVehicleRow, model: string, color: string) {
    setBusyId(row.id);
    setError(null);
    try {
      await updateScannedVehicle(row.id, { model, color });
      await reload();
      await onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Update failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(row: ScannedVehicleRow) {
    if (!window.confirm(`Delete all scans for …${row.vinSuffix}?`)) return;
    setBusyId(row.id);
    setError(null);
    try {
      await deleteScannedVehicleByVinSuffix(row.vinSuffix);
      await reload();
      await onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="panel">
      <div className="toolbar">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search VIN, model, color…"
        />
        <div className="tabs">
          <button
            type="button"
            className={tab === "scanned" ? "active" : ""}
            onClick={() => setTab("scanned")}
          >
            Scanned ({filteredScanned.length})
          </button>
          <button
            type="button"
            className={tab === "inventory" ? "active" : ""}
            onClick={() => setTab("inventory")}
          >
            Inventory ({filteredInventory.length})
          </button>
        </div>
      </div>

      {fileName && tab === "inventory" ? (
        <p className="meta">Active list: {fileName}</p>
      ) : null}
      {error ? <p className="err">{error}</p> : null}

      {tab === "scanned" ? (
        <div className="list">
          {filteredScanned.map((row) => (
            <VehicleEditor
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onSave={handleSave}
              onDelete={handleDelete}
            />
          ))}
          {filteredScanned.length === 0 ? <p className="empty">No scanned vehicles.</p> : null}
        </div>
      ) : (
        <div className="list">
          {filteredInventory.map((row) => (
            <div key={row.vinSuffix} className="row">
              <div>
                <strong>{row.model}</strong>
                <span>
                  {row.color} · …{row.vinSuffix}
                  {row.daysOnLot != null ? ` · ${row.daysOnLot} days` : ""}
                </span>
              </div>
            </div>
          ))}
          {filteredInventory.length === 0 ? <p className="empty">No inventory items.</p> : null}
        </div>
      )}

      <style jsx>{`
        .panel { position:relative; z-index:1; }
        .toolbar { display:flex; flex-wrap:wrap; gap:0.75rem; margin-bottom:0.85rem; }
        input {
          flex:1; min-width:220px; padding:0.65rem 0.8rem; border-radius:6px;
          border:1px solid ${tarmac.line}; background:${tarmac.asphaltCard}; color:${tarmac.text};
        }
        .tabs { display:flex; gap:0.4rem; }
        .tabs button {
          border:1px solid ${tarmac.line}; background:transparent; color:${tarmac.slate};
          border-radius:999px; padding:0.45rem 0.8rem; font-weight:700; cursor:pointer;
        }
        .tabs button.active { color:${tarmac.teal}; border-color:${tarmac.teal}; }
        .list { display:grid; gap:0.5rem; }
        .row, :global(.editor) {
          padding:0.85rem 0.95rem; border:1px solid ${tarmac.lineDim}; border-radius:6px;
          background:${tarmac.asphaltCard};
        }
        .row strong { display:block; }
        .row span, .meta, .empty { color:${tarmac.slate}; font-size:0.8rem; }
        .err { color:${tarmac.danger}; }
      `}</style>
    </div>
  );
}

function VehicleEditor({
  row,
  busy,
  onSave,
  onDelete,
}: {
  row: ScannedVehicleRow;
  busy: boolean;
  onSave: (row: ScannedVehicleRow, model: string, color: string) => Promise<void>;
  onDelete: (row: ScannedVehicleRow) => Promise<void>;
}) {
  const [model, setModel] = useState(row.model);
  const [color, setColor] = useState(row.color);

  useEffect(() => {
    setModel(row.model);
    setColor(row.color);
  }, [row.model, row.color, row.id]);

  return (
    <div className="editor">
      <div className="head">
        <strong>…{row.vinSuffix}</strong>
        <span>{new Date(row.scannedAt).toLocaleString()}</span>
      </div>
      <div className="fields">
        <label>
          Model
          <input value={model} onChange={(e) => setModel(e.target.value)} disabled={busy} />
        </label>
        <label>
          Color
          <input value={color} onChange={(e) => setColor(e.target.value)} disabled={busy} />
        </label>
      </div>
      <div className="actions">
        <button
          type="button"
          disabled={busy}
          onClick={() => void onSave(row, model.trim(), color.trim())}
        >
          Save
        </button>
        <button type="button" className="danger" disabled={busy} onClick={() => void onDelete(row)}>
          Delete
        </button>
      </div>
      <style jsx>{`
        .editor { display:grid; gap:0.65rem; }
        .head { display:flex; justify-content:space-between; gap:1rem; }
        .head span { color:${tarmac.slate}; font-size:0.78rem; }
        .fields { display:grid; gap:0.55rem; grid-template-columns:1fr 1fr; }
        label { display:grid; gap:0.25rem; font-size:0.72rem; color:${tarmac.slate}; text-transform:uppercase; letter-spacing:0.06em; }
        input {
          padding:0.55rem 0.65rem; border-radius:6px; border:1px solid ${tarmac.line};
          background:#0b1220; color:${tarmac.text}; font-size:0.9rem; text-transform:none; letter-spacing:normal;
        }
        .actions { display:flex; gap:0.5rem; }
        button {
          border:1px solid ${tarmac.line}; background:transparent; color:${tarmac.text};
          border-radius:6px; padding:0.45rem 0.75rem; font-weight:700; cursor:pointer;
        }
        .danger { color:${tarmac.danger}; border-color:rgba(248,113,113,0.45); }
      `}</style>
    </div>
  );
}
