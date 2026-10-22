"use client";

import { IconAlert } from "../UiIcons";
import EmptyState from "./EmptyState";
import SampleBar from "./SampleBar";
import type { AnalysisResult } from "@/lib/analysis";
import type { PrioritiesResult } from "@/lib/priorities";
import { pct, plural } from "@/lib/format";

interface Props {
  analysis: AnalysisResult | null;
  priorities: PrioritiesResult | null;
  isSample: boolean;
  ticks: Record<string, boolean>;
  onToggle: (key: string) => void;
  onGo: (view: "upload") => void;
  onSample: () => void;
  onUseOwn: () => void;
}

export default function ActionPlanView({ analysis, priorities, isSample, ticks, onToggle, onGo, onSample, onUseOwn }: Props) {
  if (!analysis || !priorities) {
    return (
      <div className="stack-16">
        <header className="page-head">
          <div>
            <h1>Action plan</h1>
            <p>The areas to look at first, as practical tasks.</p>
          </div>
        </header>
        <EmptyState title="No action plan yet" text="Load some reviews and the areas raising the most concerns will appear here as tasks." onUpload={() => onGo("upload")} onSample={onSample} />
      </div>
    );
  }

  return (
    <div className="stack-16">
      <header className="page-head">
        <div>
          <h1>Action plan</h1>
          <p>
            The areas where the most reviews raise a concern, each with tasks to consider. These show what customers mention, not why it happens, so
            use them as a place to start checking.
          </p>
        </div>
        <div className="page-head__actions">{isSample && <span className="badge badge--sample">Sample data</span>}</div>
      </header>

      {isSample && <SampleBar count={analysis.reviewCount} onUseOwn={onUseOwn} />}

      {priorities.smallSample && (
        <div className="alert alert--warning">
          <IconAlert />
          <p>Only {plural(priorities.totalReviews, "review")} {priorities.totalReviews === 1 ? "was" : "were"} analysed. Treat this as an early signal rather than a clear pattern.</p>
        </div>
      )}

      {priorities.priorities.length === 0 ? (
        <section className="card empty">
          <h2>No priorities to show</h2>
          <p>An area needs at least 3 reviews raising a concern before it is ranked. That can simply mean few reviews, or that few of them raised concerns.</p>
        </section>
      ) : (
        <>
          {priorities.priorities.length < 3 && (
            <p className="card__sub">Only {plural(priorities.priorities.length, "area")} had at least 3 reviews raising a concern, so fewer than three are shown.</p>
          )}
          <ol className="stack-16" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {priorities.priorities.map((p) => {
              const done = p.steps.filter((_, i) => ticks[`${p.key}:${i}`]).length;
              const status = done === 0 ? "Not started" : done === p.steps.length ? "Done" : "In progress";
              const statusClass = done === 0 ? "" : done === p.steps.length ? "badge--positive" : "badge--mixed";
              return (
                <li key={p.key} className="card plan">
                  <div className="plan__head">
                    <span className="plan__num" aria-hidden="true">{p.rank}</span>
                    <h3>{p.label}</h3>
                    <span className="badge badge--accent">Priority {p.rank}</span>
                    <span className={`badge ${statusClass}`}>{status}</span>
                  </div>
                  <p className="plan__evidence">
                    <strong>{p.concernedReviews.toLocaleString()} of {analysis.reviewCount.toLocaleString()} reviews ({pct(p.concernedReviews, analysis.reviewCount)})</strong> raise a concern about {p.label.toLowerCase()}.{" "}
                    <span className="muted">{p.themeReviews.toLocaleString()} reviews mention it in total, and {p.positiveReviews.toLocaleString()} of those were positive.</span>
                  </p>

                  <h4>{p.frequent ? "Customers frequently mention" : "Mentioned in a few reviews"}</h4>
                  <ul className="concerns">
                    {p.concerns.map((c) => (
                      <li key={c.label}>
                        <div className="concerns__line">
                          <span>{c.label}</span>
                          <strong>{plural(c.reviews, "review")}</strong>
                        </div>
                      </li>
                    ))}
                  </ul>

                  <h4>Tasks to consider</h4>
                  <ul className="tasks">
                    {p.steps.map((s, i) => {
                      const id = `task-${p.key}-${i}`;
                      return (
                        <li key={s} className="task">
                          <label htmlFor={id}>
                            <input id={id} type="checkbox" checked={!!ticks[`${p.key}:${i}`]} onChange={() => onToggle(`${p.key}:${i}`)} />
                            <span>{s}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="plan__progress">
                    <span>{done} of {p.steps.length} tasks ticked</span>
                    <div className="meter" role="img" aria-label={`${done} of ${p.steps.length} tasks ticked`}>
                      <span style={{ width: `${(done / p.steps.length) * 100}%` }} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}

      <p className="card__sub">
        Ticks and status are kept for this visit only. Saving progress between visits isn&apos;t available yet. Priorities are ranked by how many reviews raise a
        concern in each of the five main themes; “Other” has its own card under Themes but isn&apos;t ranked, because it mixes unrelated things.
      </p>
    </div>
  );
}
