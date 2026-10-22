"use client";

import Link from "next/link";
import { useState } from "react";
import Masthead from "./Masthead";
import RecordsBox from "./RecordsBox";
import RestaurantForm from "./RestaurantForm";
import { useApp } from "./AppProvider";
import { BLANK_SETTINGS, settingsIssues, type RestaurantSettings, type Section } from "@/lib/settings";
import type { CustomRecords } from "@/lib/records";

const STEPS: { title: string; blurb: string; sections: Section[] }[] = [
  { title: "Your restaurant", blurb: "So replies carry your contact details.", sections: ["basics"] },
  { title: "Hours and tables", blurb: "So we can spot visits when you were closed, or groups you couldn't seat.", sections: ["hours", "capacity"] },
  { title: "Your records", blurb: "Optional. Bills and bookings let us check who really came.", sections: [] },
];

export default function Onboarding() {
  const { finishSetup, setCustomRecords, startDemo, toast } = useApp();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<RestaurantSettings>(BLANK_SETTINGS);
  const [records, setRecords] = useState<CustomRecords | null>(null);
  const [showIssues, setShowIssues] = useState(false);

  const current = STEPS[step];
  const issues = settingsIssues(draft).filter((i) => current.sections.includes(i.section));
  const last = step === STEPS.length - 1;

  function finish(withRecords: boolean) {
    if (withRecords && records) setCustomRecords(records);
    finishSetup(draft);
    toast(`Welcome to DineTrust, ${draft.name.trim()}`, "success");
  }

  function next() {
    if (issues.length > 0) {
      setShowIssues(true);
      return;
    }
    setShowIssues(false);
    if (!last) return setStep(step + 1);
    finish(true);
  }

  return (
    <div className="shell narrow-shell">
      <Masthead subtitle="Let's set up your restaurant. It takes about a minute." />

      <div className="panel onboarding-intro">
        <p>
          <strong>
            Step {step + 1} of {STEPS.length}: {current.title}.
          </strong>{" "}
          {current.blurb}
        </p>
        <div className="progress" role="progressbar" aria-label="Setup progress" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
          <span style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      {current.sections.map((s) => (
        <RestaurantForm key={s} value={draft} onChange={setDraft} section={s} />
      ))}

      {last && (
        <>
          <RecordsBox kind="bills" custom={records} onChange={setRecords} />
          <RecordsBox kind="reservations" custom={records} onChange={setRecords} />
        </>
      )}

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
          {last && (
            <button type="button" className="btn" onClick={() => finish(false)}>
              Skip for now
            </button>
          )}
        </div>
        <div className="onboarding-shortcuts">
          <button type="button" className="link-button" onClick={() => startDemo()}>
            Try with sample data instead
          </button>
          <Link href="/about">What is DineTrust?</Link>
        </div>
      </div>
    </div>
  );
}
