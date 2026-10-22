"use client";

import Link from "next/link";
import Inbox from "@/components/Inbox";
import Dashboard from "@/components/Dashboard";
import InsightsPanel from "@/components/InsightsPanel";
import FirstReview from "@/components/FirstReview";
import Masthead from "@/components/Masthead";
import Onboarding from "@/components/Onboarding";
import Welcome from "@/components/Welcome";
import QueueBar from "@/components/QueueBar";
import RecordsPanel from "@/components/RecordsPanel";
import SettingsPanel from "@/components/SettingsPanel";
import { useApp, type Tab } from "@/components/AppProvider";

const DEMO_COUNTS = { bills: 25, reservations: 10 };
const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "inbox", label: "Inbox" },
  { id: "insights", label: "Insights" },
  { id: "records", label: "Records" },
  { id: "restaurant", label: "My Restaurant" },
];

export default function Home() {
  const { customRecords, setCustomRecords, settings, hydrated, toast, mode, tab, setTab, selectedId, setSelectedId, reviews, firstReviewDone } = useApp();

  if (!hydrated) {
    return (
      <div className="shell">
        <header className="masthead">
          <h1>DineTrust</h1>
          <p>Check a bad Google review against your own records, then reply calmly.</p>
        </header>
      </div>
    );
  }
  if (!settings) return mode === null ? <Welcome /> : <Onboarding />;
  if (mode === "own" && reviews.length === 0 && !firstReviewDone) return <FirstReview />;

  return (
    <div className="shell">
      <Masthead subtitle={`${settings.name ? `${settings.name} · ` : ""}Check a bad Google review against your own records, then reply calmly.`} />

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
            onClick={(e) => {
              setTab(t.id);
              e.currentTarget.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
            }}
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
              setSelectedId(id);
              setTab("inbox");
            }}
          />
        </div>
      )}

      <div hidden={tab !== "inbox"} role="tabpanel" id="panel-inbox" aria-labelledby="tab-inbox">
        <Inbox selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {tab === "insights" && (
        <div role="tabpanel" id="panel-insights" aria-labelledby="tab-insights" className="narrow">
          <InsightsPanel />
        </div>
      )}

      {tab === "records" && (
        <div role="tabpanel" id="panel-records" aria-labelledby="tab-records" className="narrow">
          <RecordsPanel
            custom={customRecords}
            mode={mode}
            demoCounts={DEMO_COUNTS}
            onChange={(next) => {
              setCustomRecords(next);
              toast(next ? "Your records are saved on this device" : mode === "demo" ? "Back to the sample records" : "Your uploaded records were removed", "success");
            }}
          />
        </div>
      )}

      {tab === "restaurant" && (
        <div role="tabpanel" id="panel-restaurant" aria-labelledby="tab-restaurant" className="narrow">
          <SettingsPanel />
        </div>
      )}

      <p className="footer-note">
        AI-assisted – check before posting. <Link href="/about">About DineTrust</Link>
      </p>
    </div>
  );
}
