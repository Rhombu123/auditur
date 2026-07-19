"use client";

import { useRef, useState } from "react";

import type { InventoryImportSummary, InventoryUploadLog } from "@/lib/types";
import { deleteInventoryUpload, uploadInventoryFile } from "@/lib/web-api";
import { tarmac } from "@/lib/tarmac-theme";

type Props = {
  uploads: InventoryUploadLog[];
  onChanged: () => Promise<void>;
  selectedUploadId?: string | null;
  onSelectUpload?: (uploadId: string) => void | Promise<void>;
};

function formatSource(sourceSystem: string | undefined): string {
  if (!sourceSystem || sourceSystem === "unknown") return "Unknown source";
  return sourceSystem
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function UploadPanel({
  uploads,
  onChanged,
  selectedUploadId = null,
  onSelectUpload,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<InventoryImportSummary | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const result = await uploadInventoryFile(file);
      setLastImport(result);
      if (result.uploadId && onSelectUpload) {
        await onSelectUpload(result.uploadId);
      } else {
        await onChanged();
      }
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(id: string, fileName: string) {
    if (!window.confirm(`Delete ${fileName}? This removes its inventory rows.`)) return;
    setBusy(true);
    setError(null);
    try {
      await deleteInventoryUpload(id);
      await onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <div className="desk-panel-hero">
        <div>
          <h2>Audit file uploads</h2>
          <p>
            Select an upload to load that audit across Overview and Audit. Comparing lists updates
            expected counts and completion for that file.
          </p>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn-primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Working…" : "Choose Audit File"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,text/csv,.pdf,.csv"
          hidden
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>

      {error ? <p className="err">{error}</p> : null}
      {lastImport ? (
        <div className="import-result" role="status">
          <strong>
            Imported {lastImport.itemCount} vehicle{lastImport.itemCount === 1 ? "" : "s"}
          </strong>
          <span>
            {lastImport.fileFormat.toUpperCase()} · {formatSource(lastImport.sourceSystem)}
          </span>
          {lastImport.warnings.length > 0 ? (
            <div className="warnings">
              <b>{lastImport.warnings.length} import warning{lastImport.warnings.length === 1 ? "" : "s"}</b>
              {lastImport.warnings.slice(0, 3).map((warning, index) => (
                <span key={`${warning}-${index}`}>• {warning}</span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="list">
        {uploads.length === 0 ? (
          <p className="empty">No uploads yet.</p>
        ) : (
          uploads.map((upload) => {
            const selected = selectedUploadId
              ? upload.id === selectedUploadId
              : upload.isCurrent;
            return (
              <div key={upload.id} className={selected ? "row selected" : "row"}>
                <button
                  type="button"
                  className="select"
                  onClick={() => onSelectUpload?.(upload.id)}
                >
                  <strong>
                    {upload.fileName}
                    {selected ? <span className="badge">Viewing</span> : null}
                  </strong>
                  <span>
                    {upload.itemCount} vehicles · {(upload.fileFormat ?? "pdf").toUpperCase()} · {formatSource(upload.sourceSystem)}
                    {" · "}{new Date(upload.uploadedAt).toLocaleString()}
                  </span>
                  <span>
                    {upload.scanCount > 0
                      ? `Used in audit · ${upload.scanCount} scan${upload.scanCount === 1 ? "" : "s"}${
                          upload.lastUsedAt
                            ? ` · last ${new Date(upload.lastUsedAt).toLocaleString()}`
                            : ""
                        }`
                      : "Not used in an audit yet"}
                  </span>
                  {!upload.hasStoredPdf ? (
                    <span className="unavailable">
                      Highlighted-PDF export unavailable for this audit
                    </span>
                  ) : null}
                  {upload.warnings.length > 0 ? (
                    <>
                      <span className="warning-count">
                        {upload.warnings.length} import warning{upload.warnings.length === 1 ? "" : "s"}
                      </span>
                      {upload.warnings.slice(0, 2).map((warning, index) => (
                        <span key={`${upload.id}-${warning}-${index}`}>• {warning}</span>
                      ))}
                    </>
                  ) : null}
                </button>
                <button
                  type="button"
                  className="ui-btn ui-btn-danger"
                  disabled={busy}
                  onClick={() => void handleDelete(upload.id, upload.fileName)}
                >
                  Delete
                </button>
              </div>
            );
          })
        )}
      </div>
      <style jsx>{`
        .panel { position: relative; z-index: 1; }
        .import-result {
          display: grid; gap: 0.25rem; margin-bottom: 0.75rem; padding: 0.75rem 0.9rem;
          border: 1px solid #99e6dc; border-radius: 10px; background: ${tarmac.tealSoft};
          color: ${tarmac.text}; font-size: 0.82rem;
        }
        .import-result > span, .warnings span { color: ${tarmac.slate}; font-size: 0.76rem; }
        .warnings { display: grid; gap: 0.2rem; margin-top: 0.3rem; color: ${tarmac.text}; }
        .list { display:grid; gap:0.5rem; }
        .row {
          display:flex; justify-content:space-between; gap:1rem; align-items:center;
          padding:0.8rem 0.95rem; border:1px solid ${tarmac.lineDim}; border-radius:10px;
          background:${tarmac.surface};
        }
        .row.selected {
          border-color: #99e6dc;
          background: ${tarmac.tealSoft};
        }
        .select {
          border: none; background: transparent; color: inherit; font: inherit;
          text-align: left; cursor: pointer; padding: 0; flex: 1;
        }
        .select strong { display:flex; align-items:center; gap:0.5rem; font-size:0.92rem; color:${tarmac.text}; }
        .select span { display:block; color:${tarmac.slate}; font-size:0.78rem; margin-top:0.2rem; }
        .select .unavailable, .select .warning-count { color: ${tarmac.danger}; font-weight: 600; }
        .badge {
          font-size:0.62rem; text-transform:uppercase; letter-spacing:0.06em;
          color:${tarmac.tealDeep}; border:1px solid #99e6dc; border-radius:999px; padding:0.12rem 0.45rem;
          background: ${tarmac.surface};
        }
        .empty, .err { color:${tarmac.slate}; }
        .err { color:${tarmac.danger}; margin-bottom:0.75rem; }
      `}</style>
    </div>
  );
}
