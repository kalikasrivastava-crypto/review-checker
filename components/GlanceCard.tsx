"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { summariseSample, type SampleSummary } from "@/lib/sample-summary";

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** A small, real preview of the results, built in the browser from the sample reviews and labelled as sample data. */
export default function GlanceCard() {
  const [summary, setSummary] = useState<SampleSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/sample-reviews.csv")
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("missing"))))
      .then((text) => !cancelled && setSummary(summariseSample(text)))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!summary) {
    return (
      <section className="card glance" aria-labelledby="glance-title" aria-busy={!failed}>
        <div className="glance__head">
          <h2 id="glance-title">Results at a glance</h2>
          <span className="badge badge--sample">Sample data</span>
        </div>
        {failed ? (
          <p className="glance__foot">
            The preview couldn&apos;t load. <Link href="/analyse#sample">Open the sample data</Link> to see the results.
          </p>
        ) : (
          <div className="skeleton" aria-hidden="true">
            <span style={{ height: 64 }} />
            <span style={{ height: 14, width: "70%" }} />
            <span style={{ height: 10 }} />
            <span style={{ height: 14, width: "60%" }} />
            <span style={{ height: 10 }} />
            <span style={{ height: 14, width: "50%" }} />
            <span style={{ height: 10 }} />
          </div>
        )}
      </section>
    );
  }

  const max = Math.max(1, ...summary.themes.map((t) => t.reviews));
  return (
    <section className="card glance" aria-labelledby="glance-title">
      <div className="glance__head">
        <h2 id="glance-title">Results at a glance</h2>
        <span className="badge badge--sample">Sample data</span>
      </div>
      <dl className="glance__stats">
        <div>
          <dt>Reviews analysed</dt>
          <dd>{summary.reviewCount.toLocaleString()}</dd>
        </div>
        <div>
          <dt>Average rating</dt>
          <dd>{summary.averageRating === null ? "–" : summary.averageRating.toFixed(1)}</dd>
        </div>
        <div>
          <dt>Top priority</dt>
          <dd className="glance__top">{summary.topPriority?.label ?? "–"}</dd>
        </div>
      </dl>

      <ul className="bars" aria-label="Reviews mentioning each theme">
        {summary.themes.map((t) => (
          <li key={t.key}>
            <div className="bars__line">
              <span>{t.label}</span>
              <span className="bars__n">{plural(t.reviews, "review")}</span>
            </div>
            <div className="sbar" style={{ width: `${Math.max(8, (t.reviews / max) * 100)}%` }} role="img" aria-label={`${t.positive} positive, ${t.mixed} mixed, ${t.negative} negative`}>
              {t.positive > 0 && <span className="sbar__pos" style={{ flexGrow: t.positive }} />}
              {t.mixed > 0 && <span className="sbar__mix" style={{ flexGrow: t.mixed }} />}
              {t.negative > 0 && <span className="sbar__neg" style={{ flexGrow: t.negative }} />}
            </div>
          </li>
        ))}
      </ul>
      <ul className="legend" aria-hidden="true">
        <li>
          <span className="legend__dot sbar__pos" /> Positive
        </li>
        <li>
          <span className="legend__dot sbar__mix" /> Both
        </li>
        <li>
          <span className="legend__dot sbar__neg" /> Negative
        </li>
      </ul>
      <p className="glance__foot">
        Made-up reviews, analysed by the same rules as your own file. <Link href="/analyse#sample">Explore the sample data</Link>
      </p>
    </section>
  );
}
