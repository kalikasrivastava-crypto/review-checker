"use client";

import { useState } from "react";
import RestaurantForm from "./RestaurantForm";
import { useApp } from "./AppProvider";
import { BLANK_SETTINGS, DEMO_SETTINGS, settingsIssues, type RestaurantSettings } from "@/lib/settings";

export default function SettingsPanel() {
  const { settings, setSettings, toast, entries, startDemo } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [draft, setDraft] = useState<RestaurantSettings>(() => settings ?? BLANK_SETTINGS);

  const issues = settingsIssues(draft);
  const changed = JSON.stringify(draft) !== JSON.stringify(settings);
  const checkedCount = Object.values(entries).filter((e) => e.result).length;

  return (
    <div className="stack">
      <RestaurantForm value={draft} onChange={setDraft} />

      {issues.length > 0 && (
        <div className="notice notice-warning" role="alert">
          <strong>Before you save:</strong>
          <ul className="issue-list">
            {issues.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel">
        <div className="actions">
          <button
            type="button"
            className="btn btn-solid"
            disabled={issues.length > 0 || !changed}
            onClick={() => {
              setSettings(draft);
              toast("Restaurant details saved", "success");
            }}
          >
            Save changes
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setDraft(DEMO_SETTINGS);
              toast("Sample details filled in. Press Save to keep them.", "info");
            }}
          >
            Fill in with the sample restaurant
          </button>
        </div>
        <div className="reset-box">
          {confirmReset ? (
            <>
              <p className="small">
                This replaces your restaurant details, records, checks and added reviews with the sample restaurant.
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={async () => {
                    setConfirmReset(false);
                    await startDemo({ tour: false });
                    toast("Back to the sample data", "success");
                  }}
                >
                  Yes, reset to sample data
                </button>
                <button type="button" className="btn btn-small" onClick={() => setConfirmReset(false)}>
                  Cancel
                </button>
              </div>
            </>
          ) : (
            <button type="button" className="link-button" onClick={() => setConfirmReset(true)}>
              Reset to sample data
            </button>
          )}
        </div>
        {checkedCount > 0 && (
          <p className="muted small">
            You have {checkedCount} saved check{checkedCount === 1 ? "" : "s"}. If you change hours or capacity, they are
            marked out of date and can be re-checked one by one.
          </p>
        )}
      </div>
    </div>
  );
}
