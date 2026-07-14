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
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const sourceRows = useMemo(() => {
    if (!audit) return [];
    if (list === "missing") return audit.missingToday;
    if (list === "notOnList") return audit.scannedNotOnList;
    return audit.scannedToday;
  }, [audit, list]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sourceRows;
    return sourceRows.filter(
      (row) =>
        row.vinSuffix.toLowerCase().includes(q) ||
        row.model.toLowerCase().includes(q) ||
        row.color.toLowerCase().includes(q),
    );
  }, [sourceRows, query]);

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

  const tabs = [
    ["missing", "Missing", audit.notScannedTodayCount],
    ["notOnList", "Not on list", audit.scannedNotOnListCount],
    ["scanned", "Scanned", audit.scannedTodayCount],
  ] as const;

  return (
    <div className="panel">
      <div className="desk-panel-hero">
        <div>
          <span className="label">Today’s audit</span>
          <strong className="pct">{audit.completionPercent}%</strong>
          <p>
            {audit.scannedTodayCount} of {audit.expectedCount} expected vehicles scanned
            {audit.inventoryFileName ? ` · ${audit.inventoryFileName}` : ""}
          </p>
        </div>
        <div className="hero-actions">
          <button
            type="button"
            className="ui-btn ui-btn-secondary"
            onClick={() => void onRefresh()}
          >
            Refresh
          </button>
          <button
            type="button"
            className="ui-btn ui-btn-primary"
            disabled={exporting}
            onClick={() => void handleExport()}
          >
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>

      <div className="filters">
        <div className="seg" role="tablist" aria-label="Audit lists">
          {tabs.map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={list === key}
              className={list === key ? "seg-tab active" : "seg-tab"}
              onClick={() => setList(key)}
            >
              {label}
              <span className="count">{count}</span>
            </button>
          ))}
        </div>
        <input
          className="desk-input search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search VIN, model, color…"
          aria-label="Search audit list"
        />
      </div>

      {message ? <p className="msg">{message}</p> : null}

      <div className="table">
        {rows.length === 0 ? (
          <p className="empty">
            {query.trim() ? "No vehicles match that search." : "Nothing in this list."}
          </p>
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
  .label {
    display: block;
    font-size: 0.65rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${tarmac.tealDeep};
    font-weight: 700;
  }
  .pct {
    display: block;
    font-size: 2rem;
    margin: 0.2rem 0;
    letter-spacing: -0.04em;
    color: ${tarmac.text};
  }
  .hero-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    flex-wrap: wrap;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
    margin-bottom: 0.9rem;
  }
  .seg {
    display: inline-flex;
    align-items: center;
    gap: 0.15rem;
    padding: 0.2rem;
    border-radius: 8px;
    background: ${tarmac.surfaceMuted};
    border: 1px solid ${tarmac.lineDim};
  }
  .seg-tab {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    height: 28px;
    padding: 0 0.65rem;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: ${tarmac.slate};
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }
  .seg-tab:hover {
    color: ${tarmac.text};
  }
  .seg-tab.active {
    background: ${tarmac.surface};
    color: ${tarmac.text};
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
  }
  .count {
    font-size: 0.68rem;
    font-weight: 700;
    color: ${tarmac.slateDim};
    background: ${tarmac.lineDim};
    border-radius: 999px;
    padding: 0.1rem 0.35rem;
    min-width: 1.15rem;
    text-align: center;
    line-height: 1.2;
  }
  .seg-tab.active .count {
    background: ${tarmac.tealSoft};
    color: ${tarmac.tealDeep};
  }
  .search {
    flex: 1;
    min-width: 200px;
    max-width: 320px;
  }
  @media (max-width: 900px) {
    .filters {
      flex-direction: column;
      align-items: stretch;
    }
    .seg {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .search {
      max-width: none;
      min-width: 0;
      width: 100%;
    }
    .hero-actions {
      width: 100%;
    }
    .hero-actions :global(.ui-btn) {
      flex: 1;
    }
  }
  .table { display: grid; gap: 0.45rem; }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 0.9rem;
    border: 1px solid ${tarmac.lineDim};
    border-radius: 8px;
    background: ${tarmac.surface};
  }
  .row strong { display: block; font-size: 0.92rem; color: ${tarmac.text}; }
  .row span { color: ${tarmac.slate}; font-size: 0.78rem; }
  .empty, .msg { color: ${tarmac.slate}; font-size: 0.88rem; }
`;
