"use client";

import { motion } from "framer-motion";

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

export function UploadStrip({ uploads }: { uploads: InventoryUploadLog[] }) {
  return (
    <div className="strip">
      <span className="label">PDF upload log</span>
      <div className="track">
        {uploads.length === 0 ? (
          <span className="empty">No price lists uploaded yet.</span>
        ) : (
          uploads.map((upload) => (
            <motion.div
              key={upload.id}
              className="chip"
              whileHover={{ scale: 1.02 }}
            >
              <span className="file">{upload.fileName}</span>
              <span className="meta">
                {formatDate(upload.uploadedAt)} · {upload.itemCount} vehicles
                {upload.isCurrent ? " · Active" : ""}
              </span>
            </motion.div>
          ))
        )}
      </div>

      <style jsx>{`
        .strip {
          background: ${tarmac.asphaltCard};
          border: 1px solid ${tarmac.line};
          border-radius: 8px;
          padding: 1rem 1.25rem;
        }

        .label {
          display: block;
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: ${tarmac.teal};
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
          min-width: 200px;
          padding: 0.75rem 0.9rem;
          background: ${tarmac.asphaltLight};
          border-radius: 6px;
          border: 1px solid ${tarmac.lineDim};
        }

        .file {
          display: block;
          font-weight: 700;
          font-size: 0.85rem;
          color: ${tarmac.text};
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 220px;
        }

        .meta {
          display: block;
          margin-top: 0.2rem;
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
