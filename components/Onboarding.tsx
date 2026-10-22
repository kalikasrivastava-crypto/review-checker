"use client";

import Link from "next/link";
import { useState } from "react";
import RestaurantForm from "./RestaurantForm";
import { useApp } from "./AppProvider";
import { BLANK_SETTINGS, DEMO_SETTINGS, settingsIssues, type RestaurantSettings, type Section } from "@/lib/settings";

const STEPS: { section: Section; title: string; blurb: string }[] = [
  { section: "basics", title: "Your restaurant", blurb: "So replies carry your contact details." },
  { section: "hours", title: "Opening hours", blurb: "So we can spot visits at times you were closed." },
  { section: "capacity", title: "Tables", blurb: "So we can spot parties bigger than you can seat." },
];

export default function Onboarding() {
  const { setSettings, toast } = useApp();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<RestaurantSettings>(BLANK_SETTINGS);
  const [showIssues, setShowIssues] = useState(false);

  const current = STEPS[step];
  const issues = settingsIssues(draft).filter((i) => i.section === current.section);
  const last = step === STEPS.length - 1;

  function next() {
    if (issues.length > 0) {
      setShowIssues(true);
      return;
    }
    setShowIssues(false);
    if (!last) return setStep(step + 1);
    setSettings(draft);
    toast(`Welcome to DineTrust, ${draft.name.trim()}`, "success");
  }

  return (
    <div className="shell narrow-shell">
      <header className="masthead">
        <h1>DineTrust</h1>
        <p>Let&apos;s set up your restaurant. It takes about a minute.</p>
      </header>

      <div className="panel onboarding-intro">
        <p>
          <strong>Step {step + 1} of {STEPS.length}: {current.title}.</strong> {current.blurb}
        </p>
        <div className="progress" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <RestaurantForm value={draft} onChange={setDraft} section={current.section} />

      {showIssues && issues.length > 0 && (
        <div className="notice notice-warning" role="alert">
          <ul className="issue-list">
            {issues.map((i, n) => (
              <li key={n}>{i.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="panel">
        <div className="actions">
          {step > 0 && (
            <button type="button" className="btn" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button type="button" className="btn btn-solid" onClick={next}>
            {last ? "Finish setup" : "Next"}
          </button>
        </div>
        <div className="onboarding-shortcuts">
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setSettings(DEMO_SETTINGS);
              toast("Using the demo restaurant. You can change it any time in My Restaurant.", "info");
            }}
          >
            Skip and use the demo restaurant
          </button>
          <Link href="/about">What is DineTrust?</Link>
        </div>
      </div>
    </div>
  );
}
