"use client";

import { tarmac } from "@/lib/tarmac-theme";
import type { InventoryUploadLog } from "@/lib/types";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatSource(sourceSystem: string | undefined): string {
  if (!sourceSystem || sourceSystem === "unknown") return "Unknown source";
  return sourceSystem
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type Props = {
  uploads: InventoryUploadLog[];
  selectedUploadId: string | null;
  onSelect: (uploadId: string) => void;
};

export function UploadStrip({ uploads, selectedUploadId, onSelect }: Props) {
  return (
    <div className="strip">
      <span className="label">Audit files · select to load that audit</span>
      <div className="track">
        {uploads.length === 0 ? (
          <span className="empty">No price lists uploaded yet.</span>
        ) : (
          uploads.map((upload) => {
            const selected = upload.id === selectedUploadId || upload.isCurrent;
            return (
              <button
                key={upload.id}
                type="button"
                className={selected ? "chip selected" : "chip"}
                onClick={() => onSelect(upload.id)}
              >
                <span className="file">{upload.fileName}</span>
                <span className="meta">
                  {formatDate(upload.uploadedAt)} · {upload.itemCount} vehicles
                  {" · "}{(upload.fileFormat ?? "pdf").toUpperCase()}
                  {" · "}{formatSource(upload.sourceSystem)}
                  {upload.warnings.length > 0
                    ? ` · ${upload.warnings.length} warning${upload.warnings.length === 1 ? "" : "s"}`
                    : ""}
                  {selected ? " · Viewing" : ""}
                </span>
              </button>
            );
          })
        )}
      </div>

      <style jsx>{`
        .strip {
          background: ${tarmac.surface};
          border: 1px solid ${tarmac.lineDim};
          border-radius: 10px;
          padding: 1rem 1.25rem;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .label {
          display: block;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${tarmac.tealDeep};
          margin-bottom: 0.75rem;
        }

        .track {
          display: flex;
          gap: 0.65rem;
          overflow-x: auto;
          padding-bottom: 0.25rem;
        }

        .chip {
          flex: 0 0 auto;
          min-width: 210px;
          padding: 0.85rem 0.95rem;
          background: ${tarmac.surfaceMuted};
          border-radius: 8px;
          border: 1px solid ${tarmac.lineDim};
          text-align: left;
          color: inherit;
          font: inherit;
          cursor: pointer;
        }

        .chip.selected {
          border-color: #99e6dc;
          background: ${tarmac.tealSoft};
        }

        .file {
          display: block;
          font-weight: 700;
          font-size: 0.85rem;
          color: ${tarmac.text};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 240px;
        }

        .meta {
          display: block;
          margin-top: 0.25rem;
          font-size: 0.72rem;
          color: ${tarmac.slate};
        }

        .empty {
          color: ${tarmac.slate};
          font-size: 0.88rem;
        }
      `}</style>
    </div>
  );
}
