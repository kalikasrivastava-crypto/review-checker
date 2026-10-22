"use client";

import Stars from "./Stars";
import ScoreCard from "./ScoreCard";
import EvidenceTable from "./EvidenceTable";
import ReplyComposer from "./ReplyComposer";
import RemovalReport from "./RemovalReport";
import { StatusBadge } from "./Badges";
import { useApp, type Status } from "./AppProvider";
import { buildRemovalReport } from "@/lib/report";

const STATUSES: { value: Status; label: string }[] = [
  { value: "new", label: "New" },
  { value: "checked", label: "Checked" },
  { value: "replied", label: "Replied" },
  { value: "reported", label: "Reported" },
];

const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function ReviewDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { reviews, entryOf, isStale, check, queue, setStatus, toast } = useApp();
  const review = reviews.find((r) => r.id === id);
  if (!review) return null;

  const entry = entryOf(id);
  const result = entry.result;
  const position = queue.ids.indexOf(id);
  const checking = queue.active && queue.currentId === id && position === 0;
  const queued = position > 0 || (position === 0 && !checking);
  const busy = checking || queued;

  return (
    <div className="detail">
      <button type="button" className="btn btn-small back-button" onClick={onBack}>
        ← Back to inbox
      </button>

      <section className="panel">
        <div className="detail-head">
          <div>
            <div className="review-head">
              <span className="review-author">{review.author}</span>
              <Stars rating={review.rating} />
              <span>{fullDate(review.date)}</span>
            </div>
          </div>
          <StatusBadge status={entry.status} />
        </div>
        <blockquote className="review-full">{review.text}</blockquote>
        {entry.note && <p className="notice notice-warning">{entry.note}</p>}

        <div className="actions">
          {!result ? (
            <button type="button" className="btn btn-solid" disabled={busy} onClick={() => check([id])}>
              {checking ? "Checking…" : queued ? `Queued (${position} ahead)` : "Check review"}
            </button>
          ) : (
            <button type="button" className="btn" disabled={busy} onClick={() => check([id], { force: true })}>
              {checking ? "Checking…" : queued ? "Queued" : "Re-check"}
            </button>
          )}
          <label className="inline-field">
            Status
            <select
              value={entry.status}
              onChange={(e) => {
                const next = e.target.value as Status;
                setStatus(id, next);
                toast(`Marked as ${next}`, "success");
              }}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {result && isStale(id) && (
          <p className="notice notice-warning">
            Your records or this review changed since the last check. Re-check to update the result.
          </p>
        )}
      </section>

      {busy && !result && (
        <div className="panel" aria-label="Checking the review">
          <div className="skeleton">
            <span className="skeleton-stamp" />
            <span />
            <span style={{ width: "75%" }} />
            <span style={{ width: "55%" }} />
          </div>
        </div>
      )}

      {!result && !busy && (
        <div className="empty">
          <h3>Not checked yet</h3>
          <p>Press Check review to compare this review with your records. The result is saved, so it is never checked twice.</p>
        </div>
      )}

      {result && (
        <>
          <ScoreCard result={result} />
          <EvidenceTable checks={result.checks} />
          <ReplyComposer key={id} review={review} entry={entry} result={result} />
          {result.verdict === "Suspicious" && (
            <RemovalReport
              key={id}
              initial={buildRemovalReport(review, result)}
              reported={entry.status === "reported"}
              onMarkReported={() => {
                setStatus(id, "reported");
                toast("Marked as reported", "success");
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
