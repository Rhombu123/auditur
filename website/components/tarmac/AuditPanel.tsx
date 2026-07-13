"use client";

import { useMemo, useState } from "react";

import type { DashboardData } from "@/lib/types";
import { exportHighlightedAuditPdf } from "@/lib/web-api";
import { tarmac } from "@/lib/tarmac-theme";

type Props = {
  data: DashboardData;
  onRefresh: () => Promise<void>;
};

type ListKey = "missing" | "notOnList" | "scanned";

export function AuditPanel({ data, onRefresh }: Props) {
  const audit = data.audit;
  const [list, setList] = useState<ListKey>("missing");
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!audit) return [];
    if (list === "missing") return audit.missingToday;
    if (list === "notOnList") return audit.scannedNotOnList;
    return audit.scannedToday;
  }, [audit, list]);

  async function handleExport() {
    setMessage(null);
    setExporting(true);
    try {
      await exportHighlightedAuditPdf();
      setMessage("Highlighted PDF downloaded.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  if (!audit) {
    return (
      <div className="panel">
        <p className="empty">Upload a price list to start today’s audit.</p>
        <style jsx>{styles}</style>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="hero">
        <div>
          <span className="label">Today’s audit</span>
          <strong className="pct">{audit.completionPercent}%</strong>
          <p>
            {audit.scannedTodayCount} of {audit.expectedCount} expected vehicles scanned
            {audit.inventoryFileName ? ` · ${audit.inventoryFileName}` : ""}
          </p>
        </div>
        <button type="button" className="primary" disabled={exporting} onClick={() => void handleExport()}>
          {exporting ? "Exporting…" : "Export highlighted PDF"}
        </button>
      </div>

      <div className="chips">
        {(
          [
            ["missing", `Missing (${audit.notScannedTodayCount})`],
            ["notOnList", `Not on list (${audit.scannedNotOnListCount})`],
            ["scanned", `Scanned (${audit.scannedTodayCount})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={list === key ? "chip active" : "chip"}
            onClick={() => setList(key)}
          >
            {label}
          </button>
        ))}
        <button type="button" className="chip" onClick={() => void onRefresh()}>
          Refresh
        </button>
      </div>

      {message ? <p className="msg">{message}</p> : null}

      <div className="table">
        {rows.length === 0 ? (
          <p className="empty">Nothing in this list.</p>
        ) : (
          rows.map((row) => (
            <div key={`${list}-${row.vinSuffix}`} className="row">
              <div>
                <strong>{row.model}</strong>
                <span>
                  {row.color} · …{row.vinSuffix}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}

const styles = `
  .panel { position: relative; z-index: 1; }
  .hero {
    display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem;
    padding: 1.1rem; margin-bottom: 1rem;
    background: ${tarmac.asphaltCard}; border: 1px solid ${tarmac.line}; border-radius: 8px;
  }
  .label { display:block; font-size:0.65rem; letter-spacing:0.1em; text-transform:uppercase; color:${tarmac.teal}; font-weight:800; }
  .pct { display:block; font-family: var(--font-mono), monospace; font-size: 2rem; margin: 0.2rem 0; }
  .hero p { margin: 0; color: ${tarmac.slate}; font-size: 0.88rem; max-width: 36rem; }
  .primary {
    align-self: center; padding: 0.7rem 1rem; border-radius: 6px; border: none;
    background: ${tarmac.teal}; color: #042f2e; font-weight: 800; cursor: pointer;
  }
  .primary:disabled { opacity: 0.55; cursor: wait; }
  .chips { display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom: 0.85rem; }
  .chip {
    border: 1px solid ${tarmac.line}; background: transparent; color: ${tarmac.slate};
    border-radius: 999px; padding: 0.4rem 0.8rem; font-size: 0.78rem; font-weight: 700; cursor: pointer;
  }
  .chip.active { border-color: ${tarmac.teal}; color: ${tarmac.teal}; background: rgba(13,148,136,0.12); }
  .table { display: grid; gap: 0.45rem; }
  .row {
    display:flex; justify-content:space-between; gap:1rem; padding:0.75rem 0.9rem;
    border: 1px solid ${tarmac.lineDim}; border-radius: 6px; background: ${tarmac.asphaltCard};
  }
  .row strong { display:block; font-size: 0.92rem; }
  .row span { color: ${tarmac.slate}; font-size: 0.78rem; }
  .empty, .msg { color: ${tarmac.slate}; font-size: 0.88rem; }
  .msg { margin-bottom: 0.75rem; color: ${tarmac.teal}; }
`;
