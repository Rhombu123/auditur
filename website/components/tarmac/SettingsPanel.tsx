"use client";

import { useEffect, useState } from "react";

import { clearLockedLotView, loadLockedLotView } from "@/lib/lot-map-view";
import { isDemoLotEnabled, resetDemoLot } from "@/lib/demo-store";
import { tarmac } from "@/lib/tarmac-theme";

type Props = {
  onDemoReset?: () => void;
};

export function SettingsPanel({ onDemoReset }: Props) {
  const [hasLockedView, setHasLockedView] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setHasLockedView(Boolean(loadLockedLotView()));
    setDemoMode(isDemoLotEnabled());
  }, []);

  function handleClearLock() {
    clearLockedLotView();
    setHasLockedView(false);
    setMessage("Lot camera lock cleared. Open Map to frame a new area.");
  }

  function handleResetDemo() {
    resetDemoLot();
    setDemoMode(true);
    setMessage("Demo lot reset to the sample inventory.");
    onDemoReset?.();
  }

  return (
    <div className="panel">
      <div className="desk-panel-hero">
        <div>
          <h2>Settings</h2>
          <p>Desk preferences for this browser. Changes apply immediately.</p>
        </div>
      </div>

      {message ? <p className="msg">{message}</p> : null}

      <div className="list">
        <div className="row">
          <div>
            <strong>Lot camera lock</strong>
            <span>
              {hasLockedView
                ? "A locked map view is saved on this device."
                : "No locked map view on this device."}
            </span>
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-secondary"
            disabled={!hasLockedView}
            onClick={handleClearLock}
          >
            Clear lock
          </button>
        </div>

        <div className="row">
          <div>
            <strong>Demo lot</strong>
            <span>
              {demoMode
                ? "Demo data is active in this browser."
                : "Demo mode is off for this session."}
            </span>
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-secondary"
            disabled={!demoMode}
            onClick={handleResetDemo}
          >
            Reset demo
          </button>
        </div>

        <div className="row">
          <div>
            <strong>Session</strong>
            <span>Sign out from the top bar when you’re done on a shared machine.</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .panel { position: relative; z-index: 1; }
        .msg {
          margin: 0 0 0.85rem;
          color: ${tarmac.tealDeep};
          font-size: 0.86rem;
        }
        .list { display: grid; gap: 0.55rem; }
        .row {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: center;
          padding: 0.95rem 1.05rem;
          border-radius: 10px;
          border: 1px solid ${tarmac.lineDim};
          background: ${tarmac.surface};
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
        }
        .row strong {
          display: block;
          font-size: 0.9rem;
          color: ${tarmac.text};
        }
        .row span {
          display: block;
          margin-top: 0.2rem;
          color: ${tarmac.slate};
          font-size: 0.8rem;
          line-height: 1.4;
          max-width: 28rem;
        }
      `}</style>
    </div>
  );
}
