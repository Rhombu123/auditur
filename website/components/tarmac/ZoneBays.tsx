"use client";

import { tarmac } from "@/lib/tarmac-theme";
import type { ZoneStat } from "@/lib/types";

type Props = {
  zones: ZoneStat[];
  onSelectZone?: (zoneId: string) => void;
};

export function ZoneBays({ zones, onSelectZone }: Props) {
  return (
    <div className="zones-bay">
      <span className="bay-label">Lot sections today</span>
      {zones.length === 0 ? (
        <p className="empty">No sections drawn yet. Paint zones on the Map tab.</p>
      ) : (
        <div className="zone-grid">
          {zones.map((zone) => {
            const clickable = Boolean(onSelectZone);
            const sharedProps = {
              className: clickable ? "zone-card clickable" : "zone-card",
              style: { borderLeftColor: zone.strokeColor },
            };
            const body = (
              <>
                <span className="swatch" style={{ background: zone.strokeColor }} />
                <div className="copy">
                  <span className="name">{zone.name}</span>
                  <span className="unit">Scans today</span>
                </div>
                <span className="count">{zone.count}</span>
              </>
            );
            return clickable ? (
              <button
                key={zone.id}
                type="button"
                {...sharedProps}
                onClick={() => onSelectZone?.(zone.id)}
              >
                {body}
              </button>
            ) : (
              <div key={zone.id} {...sharedProps}>
                {body}
              </div>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .zones-bay {
          background: ${tarmac.surface};
          border: 1px solid ${tarmac.lineDim};
          border-radius: 10px;
          padding: 1.25rem;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
        }

        .bay-label {
          display: block;
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: ${tarmac.tealDeep};
          margin-bottom: 1rem;
        }

        .zone-grid {
          display: grid;
          gap: 0.7rem;
        }

        .zone-card {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          width: 100%;
          text-align: left;
          padding: 0.9rem 1rem;
          background: ${tarmac.surfaceMuted};
          border-radius: 8px;
          border: 1px solid ${tarmac.lineDim};
          border-left: 4px solid ${tarmac.teal};
          color: inherit;
          font: inherit;
        }

        .zone-card.clickable {
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
        }

        .zone-card.clickable:hover {
          background: ${tarmac.tealSoft};
          border-color: #99e6dc;
        }

        .swatch {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .copy {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 0.28rem;
        }

        .name {
          font-weight: 700;
          color: ${tarmac.text};
          font-size: 0.95rem;
          line-height: 1.2;
        }

        .unit {
          font-size: 0.7rem;
          color: ${tarmac.slate};
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .count {
          font-size: 1.45rem;
          font-weight: 800;
          color: ${tarmac.text};
          line-height: 1;
          padding-left: 0.5rem;
          border-left: 1px solid ${tarmac.lineDim};
          min-width: 2.4rem;
          text-align: right;
          letter-spacing: -0.03em;
        }

        .empty {
          color: ${tarmac.slate};
          font-size: 0.88rem;
          line-height: 1.5;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
