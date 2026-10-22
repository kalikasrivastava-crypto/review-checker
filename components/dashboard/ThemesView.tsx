"use client";

import { useState } from "react";
import EmptyState from "./EmptyState";
import SampleBar from "./SampleBar";
import ThemeCard from "../ThemeCard";
import type { AnalysisResult, Tone } from "@/lib/analysis";
import { plural } from "@/lib/format";

type Filter = "all" | Tone;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All themes" },
  { id: "negative", label: "Mostly negative" },
  { id: "mixed", label: "Mixed" },
  { id: "positive", label: "Mostly positive" },
];

interface Props {
  analysis: AnalysisResult | null;
  isSample: boolean;
  onGo: (view: "upload") => void;
  onSample: () => void;
  onUseOwn: () => void;
}

export default function ThemesView({ analysis, isSample, onGo, onSample, onUseOwn }: Props) {
  const [filter, setFilter] = useState<Filter>("all");

  if (!analysis) {
    return (
      <div className="stack-16">
        <header className="page-head">
          <div>
            <h1>Themes</h1>
            <p>The topics customers keep mentioning, with real example reviews.</p>
          </div>
        </header>
        <EmptyState title="No themes to show yet" text="Load some reviews and the themes customers mention will appear here." onUpload={() => onGo("upload")} onSample={onSample} />
      </div>
    );
  }

  const ordered = [...analysis.themes].sort(
    (a, b) => Number(b.reviews > 0) - Number(a.reviews > 0) || Number(a.key === "other") - Number(b.key === "other") || b.reviews - a.reviews,
  );
  const shown = ordered.filter((t) => filter === "all" || (t.reviews > 0 && t.sentiment === filter));

  return (
    <div className="stack-16">
      <header className="page-head">
        <div>
          <h1>Themes</h1>
          <p>
            What customers mention across {plural(analysis.reviewCount, "review")}. A review can mention several themes, so the counts add up to more
            than the number of reviews.
          </p>
        </div>
        <div className="page-head__actions">{isSample && <span className="badge badge--sample">Sample data</span>}</div>
      </header>

      {isSample && <SampleBar count={analysis.reviewCount} onUseOwn={onUseOwn} />}

      <div className="segmented" role="group" aria-label="Filter themes by sentiment">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      <div className="theme-list">
        {shown.length === 0 ? (
          <p className="card card--pad card__sub">No themes lean that way in these reviews.</p>
        ) : (
          shown.map((t) => <ThemeCard key={t.key} theme={t} totalReviews={analysis.reviewCount} />)
        )}
      </div>

      <details className="card card--pad details">
        <summary>How this was worked out</summary>
        <ul className="details-body prose-list">
          <li>Each review is split into short pieces and checked against lists of phrases for each theme. Nothing is sent to an AI, and your file stays in your browser.</li>
          <li>A “not” or “never” just before a phrase turns it around, so “not cold” is not counted as a concern.</li>
          <li>A theme is “mostly positive” or “mostly negative” when at least 60% of its reviews lean that way. Otherwise it is “mixed”.</li>
          <li>It reads English only, can misread sarcasm or unusual wording, and only finds phrases it knows. Treat the counts as a guide to what customers mention, not as proof of why things happen.</li>
        </ul>
      </details>
    </div>
  );
}
