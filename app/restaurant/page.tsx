"use client";

import Link from "next/link";
import AuthScreen from "@/components/AuthScreen";
import Dashboard from "@/components/Dashboard";
import FeedbackPanel from "@/components/FeedbackPanel";
import FirstReview from "@/components/FirstReview";
import Inbox from "@/components/Inbox";
import InsightsPanel from "@/components/InsightsPanel";
import Masthead from "@/components/Masthead";
import Onboarding from "@/components/Onboarding";
import QueueBar from "@/components/QueueBar";
import RecordsPanel from "@/components/RecordsPanel";
import SettingsPanel from "@/components/SettingsPanel";
import { useApp, type Tab } from "@/components/AppProvider";
import { supabaseConfigured } from "@/lib/supabase-browser";

export default function RestaurantHome() {
  const { auth, hydrated, restaurant, settings, isDemo, tab, setTab, selectedId, setSelectedId, reviews, firstReviewDone, feedback } = useApp();
  const newFeedback = feedback.filter((f) => f.status === "new").length;

  const tabs: { id: Tab; label: string }[] = [
    { id: "dashboard", label: "Dashboard" },
    { id: "inbox", label: "Inbox" },
    { id: "feedback", label: newFeedback ? `Guest feedback (${newFeedback})` : "Guest feedback" },
    { id: "insights", label: "Insights" },
    { id: "records", label: "Records" },
    { id: "restaurant", label: "My Restaurant" },
  ];

  if (!supabaseConfigured) {
    return (
      <div className="shell narrow-shell">
        <p className="notice notice-error">DineTrust isn&apos;t connected to its database yet. The Supabase settings are missing on this server.</p>
      </div>
    );
  }

  if (auth === "loading" || (auth === "in" && !hydrated)) {
    return (
      <div className="shell">
        <header className="masthead">
          <h1>DineTrust</h1>
          <p>{auth === "in" ? "Getting your restaurant ready…" : "Check a bad Google review against your own records, then reply calmly."}</p>
        </header>
      </div>
    );
  }
  if (auth === "out") return <AuthScreen />;
  if (!restaurant || !settings) return <Onboarding />;
  if (!isDemo && reviews.length === 0 && !firstReviewDone) return <FirstReview />;

  return (
    <div className="shell">
      <Masthead subtitle="Check a bad Google review against your own records, then reply calmly." />

      <nav className="tabs" role="tablist" aria-label="Sections">
        {tabs.map((t) => (
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

      {tab === "feedback" && (
        <div role="tabpanel" id="panel-feedback" aria-labelledby="tab-feedback" className="narrow">
          <FeedbackPanel />
        </div>
      )}

      {tab === "insights" && (
        <div role="tabpanel" id="panel-insights" aria-labelledby="tab-insights" className="narrow">
          <InsightsPanel />
        </div>
      )}

      {tab === "records" && (
        <div role="tabpanel" id="panel-records" aria-labelledby="tab-records" className="narrow">
          <RecordsPanel />
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
