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
  searchQuery: string;
};

export function VehiclesPanel({ onChanged, searchQuery }: Props) {
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
    const q = searchQuery.trim().toLowerCase();
    if (!q) return scanned;
    return scanned.filter(
      (row) =>
        row.vinSuffix.toLowerCase().includes(q) ||
        row.model.toLowerCase().includes(q) ||
        row.color.toLowerCase().includes(q),
    );
  }, [scanned, searchQuery]);

  const filteredInventory = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (row) =>
        row.vinSuffix.toLowerCase().includes(q) ||
        row.model.toLowerCase().includes(q) ||
        row.color.toLowerCase().includes(q),
    );
  }, [inventory, searchQuery]);

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
      <div className="desk-toolbar">
        <button
          type="button"
          className={tab === "scanned" ? "ui-btn ui-btn-tool active" : "ui-btn ui-btn-tool"}
          onClick={() => setTab("scanned")}
        >
          Scanned ({filteredScanned.length})
        </button>
        <button
          type="button"
          className={tab === "inventory" ? "ui-btn ui-btn-tool active" : "ui-btn ui-btn-tool"}
          onClick={() => setTab("inventory")}
        >
          Inventory ({filteredInventory.length})
        </button>
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
        .panel { position: relative; z-index: 1; }
        .list { display: grid; gap: 0.5rem; }
        .row, :global(.editor) {
          padding: 0.85rem 0.95rem;
          border: 1px solid ${tarmac.lineDim};
          border-radius: 8px;
          background: ${tarmac.surface};
        }
        .row strong { display: block; color: ${tarmac.text}; }
        .row span, .meta, .empty { color: ${tarmac.slate}; font-size: 0.8rem; }
        .err { color: ${tarmac.danger}; }
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
          <input
            className="desk-input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Color
          <input
            className="desk-input"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={busy}
          />
        </label>
      </div>
      <div className="actions">
        <button
          type="button"
          className="ui-btn ui-btn-primary"
          disabled={busy}
          onClick={() => void onSave(row, model.trim(), color.trim())}
        >
          Save
        </button>
        <button
          type="button"
          className="ui-btn ui-btn-danger"
          disabled={busy}
          onClick={() => void onDelete(row)}
        >
          Delete
        </button>
      </div>
      <style jsx>{`
        .editor { display: grid; gap: 0.65rem; }
        .head { display: flex; justify-content: space-between; gap: 1rem; }
        .head strong { color: ${tarmac.text}; }
        .head span { color: ${tarmac.slate}; font-size: 0.78rem; }
        .fields { display: grid; gap: 0.55rem; grid-template-columns: 1fr 1fr; }
        @media (max-width: 640px) {
          .fields { grid-template-columns: 1fr; }
        }
        label {
          display: grid;
          gap: 0.25rem;
          font-size: 0.72rem;
          color: ${tarmac.slate};
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 600;
        }
        .actions { display: flex; gap: 0.5rem; flex-wrap: wrap; }
      `}</style>
    </div>
  );
}
