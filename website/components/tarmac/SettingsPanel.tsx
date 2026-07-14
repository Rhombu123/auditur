"use client";

import { useEffect, useState } from "react";

import { clearLockedLotView, loadLockedLotView } from "@/lib/lot-map-view";
import { isDemoLotEnabled, resetDemoLot } from "@/lib/demo-store";
import { tarmac } from "@/lib/tarmac-theme";
import {
  defaultUserPreferences,
  loadUserPreferences,
  resetUserPreferences,
  saveUserPreferences,
  type UserPreferences,
} from "@/lib/user-preferences";

type Props = {
  onDemoReset?: () => void;
};

export function SettingsPanel({ onDemoReset }: Props) {
  const [hasLockedView, setHasLockedView] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences>(defaultUserPreferences);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setHasLockedView(Boolean(loadLockedLotView()));
    setDemoMode(isDemoLotEnabled());
    setPreferences(loadUserPreferences());
  }, []);

  function updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) {
    const next = { ...preferences, [key]: value };
    setPreferences(next);
    saveUserPreferences(next);
    setMessage("Preference saved on this device.");
  }

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

  function handleResetPreferences() {
    setPreferences(resetUserPreferences());
    setMessage("Device preferences restored to defaults.");
  }

  const toggles: {
    key: "requireGps" | "duplicateVinWarnings" | "scanConfirmation";
    title: string;
    description: string;
  }[] = [
    {
      key: "requireGps",
      title: "Require GPS for scans",
      description: "Treat location as required evidence when a vehicle is verified.",
    },
    {
      key: "duplicateVinWarnings",
      title: "Duplicate VIN warnings",
      description: "Warn when a VIN has already been recorded in the current audit.",
    },
    {
      key: "scanConfirmation",
      title: "Scan confirmation",
      description: "Show a confirmation before a newly scanned vehicle is saved.",
    },
  ];

  return (
    <div className="panel">
      <div className="desk-panel-hero">
        <div>
          <h2>Settings</h2>
          <p>Desk preferences for this browser. Changes apply immediately.</p>
        </div>
      </div>

      {message ? <p className="msg">{message}</p> : null}

      <section>
        <div className="section-title">
          <strong>Audit defaults</strong>
          <span>Saved for this device</span>
        </div>
        <div className="list">
          {toggles.map((item) => (
            <div className="row" key={item.key}>
              <div>
                <strong>{item.title}</strong>
                <span>{item.description}</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences[item.key]}
                aria-label={item.title}
                className={preferences[item.key] ? "switch on" : "switch"}
                onClick={() => updatePreference(item.key, !preferences[item.key])}
              >
                <i />
              </button>
            </div>
          ))}

          <div className="row">
            <div>
              <strong>Dealership timezone</strong>
              <span>Used for the dealership workday and audit dates.</span>
            </div>
            <select
              className="desk-input timezone"
              value={preferences.timezone}
              onChange={(event) => updatePreference("timezone", event.target.value)}
              aria-label="Dealership timezone"
            >
              {[
                preferences.timezone,
                "America/New_York",
                "America/Chicago",
                "America/Denver",
                "America/Los_Angeles",
                "UTC",
              ]
                .filter((zone, index, zones) => zones.indexOf(zone) === index)
                .map((zone) => (
                  <option key={zone} value={zone}>
                    {zone.replaceAll("_", " ")}
                  </option>
                ))}
            </select>
          </div>
        </div>
      </section>

      <section>
        <div className="section-title">
          <strong>Device and map</strong>
        </div>
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

        {demoMode ? <div className="row">
          <div>
            <strong>Demo lot</strong>
            <span>Demo data is active in this browser.</span>
          </div>
          <button
            type="button"
            className="ui-btn ui-btn-secondary"
            onClick={handleResetDemo}
          >
            Reset demo
          </button>
        </div> : null}

        <div className="row">
          <div>
            <strong>Local preferences</strong>
            <span>Restore audit and device preferences to their defaults.</span>
          </div>
          <button type="button" className="ui-btn ui-btn-secondary" onClick={handleResetPreferences}>
            Reset preferences
          </button>
        </div>
        </div>
      </section>

      <section>
        <div className="section-title">
          <strong>Help and account</strong>
        </div>
        <div className="list">
          <div className="row">
            <div>
              <strong>Support</strong>
              <span>Questions, privacy requests, and account deletion requests.</span>
            </div>
            <a className="ui-btn ui-btn-secondary" href="mailto:support@auditur.app">
              Email support
            </a>
          </div>
          <div className="row">
            <div>
              <strong>Auditur version</strong>
              <span>Web dashboard · Version 1.0.0</span>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .panel { position: relative; z-index: 1; }
        .msg {
          margin: 0 0 0.85rem;
          color: ${tarmac.tealDeep};
          font-size: 0.86rem;
        }
        section + section { margin-top: 1.25rem; }
        .section-title {
          display: flex;
          align-items: baseline;
          gap: 0.55rem;
          margin: 0 0 0.55rem;
        }
        .section-title strong {
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: ${tarmac.text};
        }
        .section-title span {
          font-size: 0.7rem;
          color: ${tarmac.slate};
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
        .switch {
          position: relative;
          flex: 0 0 auto;
          width: 2.45rem;
          height: 1.4rem;
          padding: 0;
          border: 1px solid ${tarmac.line};
          border-radius: 999px;
          background: ${tarmac.lineDim};
          cursor: pointer;
          transition: background 150ms ease, border-color 150ms ease;
        }
        .switch i {
          position: absolute;
          top: 0.16rem;
          left: 0.17rem;
          width: 0.95rem;
          height: 0.95rem;
          border-radius: 50%;
          background: ${tarmac.surface};
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
          transition: transform 150ms ease;
        }
        .switch.on {
          border-color: ${tarmac.teal};
          background: ${tarmac.teal};
        }
        .switch.on i { transform: translateX(1rem); }
        .timezone {
          width: min(18rem, 100%);
          min-width: 12rem;
        }
      `}</style>
    </div>
  );
}
