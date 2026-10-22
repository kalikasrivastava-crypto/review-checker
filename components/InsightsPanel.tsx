"use client";

import FootfallView from "./FootfallView";
import { useApp } from "./AppProvider";

export default function InsightsPanel() {
  const { insights: data, insightsLoading } = useApp();

  if (!data && !insightsLoading) return <p className="notice notice-error">Couldn&apos;t load insights. Try again.</p>;
  if (!data) {
    return (
      <div className="panel" aria-label="Loading insights">
        <div className="skeleton">
          <span />
          <span style={{ width: "80%" }} />
          <span style={{ width: "60%" }} />
        </div>
      </div>
    );
  }

  const max = Math.max(1, ...data.themes.map((t) => t.count));

  const flaggedClaimDays = data.footfall
    ? data.footfall.days.filter((d) => d.claims.length > 0 && (!d.inRecords || d.bills === 0))
    : [];

  return (
    <div className="stack">
      <section className="panel">
        <h2>Footfall vs. claimed visits</h2>
        {data.footfall ? (
          <>
            <p className="muted">
              How busy each day really was, from your bills, next to the days that 1–2 star reviews say they visited.
              {flaggedClaimDays.length > 0
                ? ` ${flaggedClaimDays.length} claimed day${flaggedClaimDays.length === 1 ? " has" : "s have"} no bills at all, so check those against your records.`
                : " Every claimed day has bills on file."}
            </p>
            <FootfallView footfall={data.footfall} />
          </>
        ) : (
          <p className="muted">Upload your bills in the Records tab to see how busy each day was.</p>
        )}
      </section>

      <section className="panel">
        <h2>What genuine complaints are about</h2>
        <p className="muted">
          {data.genuine} of {data.total} reviews look like genuine complaints. The other{" "}
          {data.total - data.genuine} were left out because they are positive, don&apos;t fit your records, or are
          unconfirmed bursts. Themes come from keywords in the review text, so treat the counts as a guide.
        </p>
        <ul className="theme-list">
          {data.themes.map((t) => (
            <li key={t.key}>
              <div className="theme-head">
                <strong>{t.label}</strong>
                <span className="theme-count">{t.count}</span>
              </div>
              <div className="theme-bar" aria-hidden="true">
                <span style={{ width: `${(t.count / max) * 100}%` }} />
              </div>
              {t.reviews.length === 0 ? (
                <p className="muted">No genuine complaints about this.</p>
              ) : (
                <ul className="theme-reviews">
                  {t.reviews.map((r) => (
                    <li key={r.id}>
                      <strong>{r.author}:</strong> {r.snippet}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>Look-alike reviews</h2>
        {data.similarPairs.length === 0 ? (
          <p className="muted">No reviews with very similar wording. Look-alike text across different accounts can mean copy-and-paste posting.</p>
        ) : (
          <>
            <p className="muted">These reviews use very similar words and phrases. Copy-and-paste wording across accounts is a warning sign.</p>
            <ul className="pair-list">
              {data.similarPairs.map((p) => (
                <li key={p.a.id + p.b.id} className="pair">
                  <p className="pair-score">{Math.round(p.score * 100)}% alike</p>
                  <p>
                    <strong>{p.a.author}:</strong> {p.a.snippet}
                  </p>
                  <p>
                    <strong>{p.b.author}:</strong> {p.b.snippet}
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {data.excluded.length > 0 && (
        <section className="panel">
          <h2>Left out, and why</h2>
          <ul className="theme-reviews">
            {data.excluded.map((e) => (
              <li key={e.id}>
                <strong>{e.author}:</strong> {e.reason}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
