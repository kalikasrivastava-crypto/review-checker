"use client";

import Stars from "./Stars";
import SplitChart from "./SplitChart";
import TrendChart from "./TrendChart";
import { EntryBadges } from "./Badges";
import { useApp } from "./AppProvider";
import { computeStats } from "@/lib/dashboard";

const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function Delta({ value, unit = "", invert = false }: { value: number | null; unit?: string; invert?: boolean }) {
  if (value === null || Math.abs(value) < 0.05) return <span className="card-sub">no change from last week</span>;
  const good = invert ? value < 0 : value > 0;
  return (
    <span className={`card-sub ${good ? "delta-good" : "delta-bad"}`}>
      {value > 0 ? "▲" : "▼"} {Math.abs(value).toFixed(unit === "" ? 1 : 0)}
      {unit} vs last week
    </span>
  );
}

export default function Dashboard({ onOpen }: { onOpen: (id: string) => void }) {
  const { reviews, entries, entryOf, insights, insightsLoading, anchorDate, check, queue, hydrated, setTab, feedback } = useApp();

  if (!hydrated || (insightsLoading && !insights)) {
    return (
      <div className="stack" aria-label="Loading dashboard">
        <div className="card-grid">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="panel">
              <div className="skeleton">
                <span style={{ width: "50%" }} />
                <span style={{ height: 30, width: "40%" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <section className="panel empty-state">
        <h2>No reviews yet</h2>
        <p className="muted">Add the first bad review you want to check. DineTrust will compare it with your records.</p>
        <div className="actions">
          <button type="button" className="btn btn-solid" onClick={() => setTab("inbox")}>
            Go to the Inbox to add one
          </button>
        </div>
      </section>
    );
  }

  const stats = computeStats(reviews, entries, insights?.screens, anchorDate);
  const unchecked = reviews.filter((r) => r.rating <= 3 && !entries[r.id]?.result).map((r) => r.id);
  const queued = new Set(queue.ids);

  return (
    <div className="stack">
      <p className="muted week-note">
        Showing the week ending {day(anchorDate)}, measured from your newest review.
      </p>

      {feedback.length > 0 && (
        <section className="panel fb-banner">
          <p>
            <strong>{feedback.filter((f) => f.status === "new").length} new</strong> guest feedback
            {feedback.filter((f) => f.status === "new" && f.rating <= 3).length > 0 &&
              ` (${feedback.filter((f) => f.status === "new" && f.rating <= 3).length} rated 1 to 3 stars)`}
            . Sent privately by guests through your QR page.
          </p>
          <button type="button" className="btn btn-small" onClick={() => setTab("feedback")}>
            Read guest feedback
          </button>
        </section>
      )}

      <div className="card-grid">
        <section className="panel stat-card">
          <h2 className="stat-label">Average rating</h2>
          <p className="stat-value">{stats.avgRating === null ? "–" : stats.avgRating.toFixed(1)}</p>
          <Delta value={stats.avgDelta} />
        </section>
        <section className="panel stat-card">
          <h2 className="stat-label">Reviews this week</h2>
          <p className="stat-value">{stats.thisWeek}</p>
          <Delta value={stats.thisWeek - stats.prevWeek} unit=" " />
        </section>
        <section className="panel stat-card">
          <h2 className="stat-label">Suspicious</h2>
          <p className="stat-value">{stats.suspiciousPct === null ? "–" : `${stats.suspiciousPct}%`}</p>
          <span className="card-sub">
            {stats.suspiciousCount} of {reviews.length} reviews ({stats.checkedCount} checked)
          </span>
        </section>
        <section className="panel stat-card">
          <h2 className="stat-label">Waiting for a reply</h2>
          <p className="stat-value">{stats.waitingReply}</p>
          <span className="card-sub">1–3★ reviews not yet replied to</span>
        </section>
      </div>

      <div className="chart-grid-2">
        <section className="panel">
          <h2>Rating trend</h2>
          <TrendChart trend={stats.trend} />
        </section>
        <section className="panel">
          <h2>Suspicious vs genuine</h2>
          <SplitChart suspicious={stats.suspiciousCount} genuine={stats.genuineCount} />
          <p className="muted small">
            Reviews you have AI-checked use that verdict. The rest use a quick screen of your records.
          </p>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Needs attention</h2>
          {unchecked.length > 0 && (
            <button
              type="button"
              className="btn"
              disabled={queue.active}
              onClick={() => check(unchecked)}
              title="Checks one review at a time to stay within the free AI limit"
            >
              Check all {unchecked.length} unchecked
            </button>
          )}
        </div>
        {stats.attention.length === 0 ? (
          <div className="empty">
            <h3>All caught up</h3>
            <p>No unhandled 1–2 star reviews. New ones will show up here.</p>
          </div>
        ) : (
          <ul className="attention-list">
            {stats.attention.map((r) => {
              const entry = entryOf(r.id);
              const isQueued = queued.has(r.id);
              return (
                <li key={r.id} className="attention-item">
                  <div className="attention-main">
                    <div className="review-head">
                      <span className="review-author">{r.author}</span>
                      <Stars rating={r.rating} />
                      <span>{day(new Date(r.date))}</span>
                      <EntryBadges entry={entry} />
                    </div>
                    <p className="review-snippet">{r.text}</p>
                  </div>
                  <div className="attention-actions">
                    {entry.result ? (
                      <button type="button" className="btn" onClick={() => onOpen(r.id)}>
                        Open
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-solid"
                        disabled={isQueued}
                        onClick={() => check([r.id])}
                      >
                        {isQueued ? (queue.currentId === r.id ? "Checking…" : "Queued") : "Check"}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
