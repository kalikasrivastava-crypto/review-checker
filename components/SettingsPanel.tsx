"use client";

import { useState } from "react";
import RestaurantForm from "./RestaurantForm";
import { useApp } from "./AppProvider";
import { BLANK_SETTINGS, DEMO_SETTINGS, settingsIssues, type RestaurantSettings } from "@/lib/settings";

export default function SettingsPanel() {
  const { settings, setSettings, toast, entries } = useApp();
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
              toast("Demo restaurant loaded. Press Save to keep it.", "info");
            }}
          >
            Load the demo restaurant
          </button>
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
