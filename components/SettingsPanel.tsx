"use client";

import { useState } from "react";
import CustomerPageCard from "./CustomerPageCard";
import RestaurantForm from "./RestaurantForm";
import { useApp } from "./AppProvider";
import { BLANK_SETTINGS, settingsIssues, type RestaurantSettings } from "@/lib/settings";

export default function SettingsPanel() {
  const { settings, saveSettings, toast, entries, resetDemo, isDemo } = useApp();
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [draft, setDraft] = useState<RestaurantSettings>(() => settings ?? BLANK_SETTINGS);

  const issues = settingsIssues(draft);
  const changed = JSON.stringify(draft) !== JSON.stringify(settings);
  const checkedCount = Object.values(entries).filter((e) => e.result).length;

  return (
    <div className="stack">
      <CustomerPageCard />
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
            disabled={issues.length > 0 || !changed || saving}
            onClick={async () => {
              setSaving(true);
              const ok = await saveSettings(draft);
              setSaving(false);
              toast(ok ? "Restaurant details saved" : "Couldn't save. Try again.", ok ? "success" : "error");
            }}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
        {isDemo && (
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
                    await resetDemo();
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
        )}
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
