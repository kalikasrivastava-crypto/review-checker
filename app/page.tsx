"use client";

import { useState } from "react";
import CheckerView from "@/components/CheckerView";
import Dashboard from "@/components/Dashboard";
import InsightsPanel from "@/components/InsightsPanel";
import QueueBar from "@/components/QueueBar";
import RecordsPanel from "@/components/RecordsPanel";
import { useApp } from "@/components/AppProvider";

const DEMO_COUNTS = { bills: 25, reservations: 10 };
type Tab = "dashboard" | "checker" | "insights" | "records";
const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "checker", label: "Checker" },
  { id: "insights", label: "Insights" },
  { id: "records", label: "Records" },
];

export default function Home() {
  const { customRecords, setCustomRecords } = useApp();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [focus, setFocus] = useState<{ id: string; n: number } | null>(null);

  return (
    <div className="shell">
      <header className="masthead">
        <h1>DineTrust</h1>
        <p>Check a suspicious Google review against your own records, then reply calmly.</p>
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className="tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        {customRecords && <span className="tab-note">Using your records</span>}
      </nav>

      <QueueBar />

      {tab === "dashboard" && (
        <div role="tabpanel" id="panel-dashboard" aria-labelledby="tab-dashboard">
          <Dashboard
            onOpen={(id) => {
              setFocus((f) => ({ id, n: (f?.n ?? 0) + 1 }));
              setTab("checker");
            }}
          />
        </div>
      )}

      <div hidden={tab !== "checker"} role="tabpanel" id="panel-checker" aria-labelledby="tab-checker">
        <CheckerView focusId={focus} />
      </div>

      {tab === "insights" && (
        <div role="tabpanel" id="panel-insights" aria-labelledby="tab-insights" className="narrow">
          <InsightsPanel />
        </div>
      )}

      {tab === "records" && (
        <div role="tabpanel" id="panel-records" aria-labelledby="tab-records" className="narrow">
          <RecordsPanel custom={customRecords} demoCounts={DEMO_COUNTS} onChange={setCustomRecords} />
        </div>
      )}

      <p className="footer-note">AI-assisted – check before posting.</p>
    </div>
  );
}
