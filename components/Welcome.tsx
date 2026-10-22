"use client";

import Link from "next/link";
import { useState } from "react";
import CsvNeeds from "./CsvNeeds";
import Modal from "./Modal";

const STEPS = [
  { n: 1, title: "Upload your reviews", text: "A spreadsheet of customer reviews, saved as a CSV file." },
  { n: 2, title: "See what they mention", text: "Food, service speed, cleanliness, pricing and ambience, with real counts." },
  { n: 3, title: "Get three places to look first", text: "The areas customers raise concerns about most, with practical next steps." },
];

/** The home page content: what DineTrust does and the two ways in. */
export default function Welcome() {
  const [explainer, setExplainer] = useState(false);

  return (
    <section className="panel welcome">
      <h2 className="welcome-title">See what your customers keep mentioning, and where to look first.</h2>
      <p className="welcome-lead muted">
        DineTrust reads the reviews you give it, groups the feedback into themes, and shows which problems come up most.
      </p>

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
        <Link href="/analyse" className="btn btn-primary welcome-main">
          Analyse my reviews
          <span className="welcome-sub">Upload a CSV file</span>
        </Link>
        <Link href="/analyse#sample" className="btn welcome-main welcome-alt">
          Try it with sample data
          <span className="welcome-sub">Made-up reviews, clearly labelled</span>
        </Link>
      </div>

      <p className="welcome-link">
        <button type="button" className="link-button" onClick={() => setExplainer(true)}>
          What file do I need?
        </button>
      </p>

      {explainer && (
        <Modal title="What file do I need?" onClose={() => setExplainer(false)}>
          <CsvNeeds />
        </Modal>
      )}
    </section>
  );
}
