"use client";

import Link from "next/link";
import { useState } from "react";
import DataNeeds from "./DataNeeds";
import Modal from "./Modal";
import TryDemoButton from "./TryDemoButton";

const STEPS = [
  { n: 1, title: "Add your records", text: "Opening hours, tables, and optionally your bills and bookings." },
  { n: 2, title: "Pick a review", text: "Paste a bad Google review you want to understand." },
  { n: 3, title: "Get a case report", text: "What fits your records, what doesn't, and what to do next." },
];

/** The landing page content: what DineTrust does and the two ways in. */
export default function Welcome() {
  const [explainer, setExplainer] = useState(false);

  return (
    <section className="panel welcome">
      <h2 className="welcome-title">Find out if a bad Google review matches a real visit.</h2>

      <ol className="how-steps" aria-label="How it works">
        {STEPS.map((s) => (
          <li key={s.n} className="how-step">
            <span className="how-num" aria-hidden="true">
              {s.n}
            </span>
            <strong>{s.title}</strong>
            <span className="muted small">{s.text}</span>
          </li>
        ))}
      </ol>

      <div className="welcome-actions">
        <Link href="/restaurant" className="btn btn-solid welcome-main">
          I&apos;m a restaurant owner
          <span className="welcome-sub">Log in or create an account</span>
        </Link>
        <div className="welcome-demo">
          <TryDemoButton label="Try the demo" className="btn btn-primary welcome-main" />
          <span className="welcome-sub-out">No sign-up. See a result in 10 seconds.</span>
        </div>
      </div>

      <p className="welcome-link">
        <button type="button" className="link-button" onClick={() => setExplainer(true)}>
          What data do I need?
        </button>
      </p>

      {explainer && (
        <Modal title="What data do I need?" onClose={() => setExplainer(false)}>
          <DataNeeds />
        </Modal>
      )}
    </section>
  );
}
