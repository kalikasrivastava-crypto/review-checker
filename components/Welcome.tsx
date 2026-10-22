"use client";

import { useState } from "react";
import DataNeeds from "./DataNeeds";
import Masthead from "./Masthead";
import Modal from "./Modal";
import { useApp } from "./AppProvider";

const STEPS = [
  { n: 1, title: "Add your records", text: "Opening hours, tables, and optionally your bills and bookings." },
  { n: 2, title: "Pick a review", text: "Paste a bad Google review you want to understand." },
  { n: 3, title: "Get a case report", text: "What fits your records, what doesn't, and what to do next." },
];

export default function Welcome() {
  const { startDemo, startSetup } = useApp();
  const [explainer, setExplainer] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <div className="shell narrow-shell">
      <Masthead subtitle="Check a bad Google review against your own records, then reply calmly." />

      <section className="panel welcome">
        <h2 className="welcome-title">Find out if a bad Google review matches a real visit.</h2>

        <ol className="how-steps" aria-label="How it works">
          {STEPS.map((s) => (
            <li key={s.n} className="how-step">
              <span className="how-num" aria-hidden="true">{s.n}</span>
              <strong>{s.title}</strong>
              <span className="muted small">{s.text}</span>
            </li>
          ))}
        </ol>

        <div className="welcome-actions">
          <button
            type="button"
            className="btn btn-primary welcome-main"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              await startDemo();
            }}
          >
            {loading ? "Loading sample data…" : "Try with sample data"}
            <span className="welcome-sub">Recommended · see a result in 10 seconds</span>
          </button>
          <button type="button" className="btn welcome-main welcome-alt" onClick={startSetup}>
            Set up my restaurant
            <span className="welcome-sub">About 1 minute</span>
          </button>
        </div>

        <p className="welcome-link">
          <button type="button" className="link-button" onClick={() => setExplainer(true)}>
            What data do I need?
          </button>
        </p>
      </section>

      {explainer && (
        <Modal title="What data do I need?" onClose={() => setExplainer(false)}>
          <DataNeeds />
        </Modal>
      )}
    </div>
  );
}
