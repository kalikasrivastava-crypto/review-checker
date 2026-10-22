"use client";

import { useEffect, useState } from "react";
import type { Insights } from "@/lib/insights";
import type { CustomRecords } from "./RecordsPanel";

export default function InsightsPanel({ custom }: { custom: CustomRecords | null }) {
  const [data, setData] = useState<Insights | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        custom ? { records: { orders: custom.orders ?? [], reservations: custom.reservations ?? [] } } : {},
      ),
    })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        if (j.ok) setData(j.insights as Insights);
        else setError("Couldn't load insights. Try again.");
      })
      .catch(() => !cancelled && setError("Couldn't load insights. Try again."));
    return () => {
      cancelled = true;
    };
  }, [custom]);

  if (error) return <p className="notice notice-error">{error}</p>;
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

  return (
    <div className="stack">
      <section className="panel">
        <h2>What genuine complaints are about</h2>
        <p className="muted">
          {data.genuine} of {data.total} sample reviews look like genuine complaints. The other{" "}
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
