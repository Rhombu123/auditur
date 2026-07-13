"use client";

import { useRef, useState } from "react";

import type { InventoryUploadLog } from "@/lib/types";
import { deleteInventoryUpload, uploadInventoryPdf } from "@/lib/web-api";
import { tarmac } from "@/lib/tarmac-theme";

type Props = {
  uploads: InventoryUploadLog[];
  onChanged: () => Promise<void>;
};

export function UploadPanel({ uploads, onChanged }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      await uploadInventoryPdf(file);
      await onChanged();
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
      <div className="hero">
        <div>
          <h2>Price list uploads</h2>
          <p>Same PDF workflow as the phone app. Active inventory comes from the latest upload.</p>
        </div>
        <button
          type="button"
          className="primary"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? "Working…" : "Upload PDF"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>

      {error ? <p className="err">{error}</p> : null}

      <div className="list">
        {uploads.length === 0 ? (
          <p className="empty">No uploads yet.</p>
        ) : (
          uploads.map((upload) => (
            <div key={upload.id} className="row">
              <div>
                <strong>
                  {upload.fileName}
                  {upload.isCurrent ? <span className="badge">Current</span> : null}
                </strong>
                <span>
                  {upload.itemCount} vehicles ·{" "}
                  {new Date(upload.uploadedAt).toLocaleString()}
                  {upload.hasStoredPdf ? "" : " · no stored PDF for export"}
                </span>
              </div>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => void handleDelete(upload.id, upload.fileName)}
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
      <style jsx>{`
        .panel { position: relative; z-index: 1; }
        .hero {
          display:flex; flex-wrap:wrap; justify-content:space-between; gap:1rem;
          margin-bottom:1rem; padding:1rem; border:1px solid ${tarmac.line};
          border-radius:8px; background:${tarmac.asphaltCard};
        }
        h2 { margin:0; font-size:1.05rem; }
        .hero p { margin:0.35rem 0 0; color:${tarmac.slate}; font-size:0.86rem; max-width:36rem; }
        .primary {
          align-self:center; border:none; border-radius:6px; padding:0.7rem 1rem;
          background:${tarmac.teal}; color:#042f2e; font-weight:800; cursor:pointer;
        }
        .list { display:grid; gap:0.5rem; }
        .row {
          display:flex; justify-content:space-between; gap:1rem; align-items:center;
          padding:0.8rem 0.95rem; border:1px solid ${tarmac.lineDim}; border-radius:6px;
          background:${tarmac.asphaltCard};
        }
        .row strong { display:flex; align-items:center; gap:0.5rem; font-size:0.92rem; }
        .row span { display:block; color:${tarmac.slate}; font-size:0.78rem; margin-top:0.2rem; }
        .badge {
          font-size:0.62rem; text-transform:uppercase; letter-spacing:0.06em;
          color:${tarmac.teal}; border:1px solid ${tarmac.teal}; border-radius:999px; padding:0.12rem 0.45rem;
        }
        .danger {
          border:1px solid rgba(248,113,113,0.45); background:transparent; color:${tarmac.danger};
          border-radius:6px; padding:0.45rem 0.7rem; font-weight:700; cursor:pointer;
        }
        .empty, .err { color:${tarmac.slate}; }
        .err { color:${tarmac.danger}; margin-bottom:0.75rem; }
      `}</style>
    </div>
  );
}
