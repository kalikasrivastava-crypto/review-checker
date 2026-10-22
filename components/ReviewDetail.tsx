"use client";

import { useState } from "react";
import CaseReport from "./CaseReport";
import ReviewQuote from "./ReviewQuote";
import { useApp, type Status } from "./AppProvider";

const STATUSES: { value: Status; label: string }[] = [
  { value: "new", label: "New" },
  { value: "checked", label: "Checked" },
  { value: "replied", label: "Replied" },
  { value: "reported", label: "Reported" },
];

/** One review: the Case Report if it has been checked, otherwise the review and a Check button. */
export default function ReviewDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { reviews, entryOf, isStale, check, queue, setStatus, deleteReview, toast } = useApp();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const review = reviews.find((r) => r.id === id);
  if (!review) return null;

  const entry = entryOf(id);
  const result = entry.result;
  const position = queue.ids.indexOf(id);
  const checking = queue.active && queue.currentId === id && position === 0;
  const queued = position > 0 || (position === 0 && !checking);
  const busy = checking || queued;

  const toolbar = (
    <>
      <div className="actions">
        {!result ? (
          <button type="button" className="btn btn-solid" disabled={busy} onClick={() => check([id])}>
            {checking ? "Checking…" : queued ? `Queued (${position} ahead)` : "Check review"}
          </button>
        ) : (
          <button type="button" className="btn btn-small" disabled={busy} onClick={() => check([id], { force: true })}>
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
        {review.source === "added" && !confirmingDelete && (
          <button type="button" className="btn btn-small btn-danger-outline" onClick={() => setConfirmingDelete(true)}>
            Delete this review
          </button>
        )}
      </div>

      {result && isStale(id) && (
        <p className="notice notice-warning">
          Your records or this review changed since the last check. Re-check to update the result.
        </p>
      )}

      {review.source === "added" && confirmingDelete && (
        <div className="notice notice-error" role="alertdialog" aria-labelledby={`del-${id}`}>
          <p id={`del-${id}`}>
            <strong>Delete this review?</strong> Its check and any reply drafts are deleted too. This can&apos;t be undone.
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                deleteReview(id);
                toast("Review deleted", "success");
                onBack();
              }}
            >
              Yes, delete it
            </button>
            <button type="button" className="btn" onClick={() => setConfirmingDelete(false)}>
              Keep it
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="detail">
      <button type="button" className="btn btn-small back-button" onClick={onBack}>
        ← Back to inbox
      </button>

      {result ? (
        <CaseReport key={id} review={review} entry={entry} result={result} toolbar={toolbar} />
      ) : (
        <>
          <ReviewQuote review={review} entry={entry}>
            {toolbar}
          </ReviewQuote>
          {busy ? (
            <div className="panel" aria-label="Checking the review">
              <div className="skeleton">
                <span className="skeleton-stamp" />
                <span />
                <span style={{ width: "75%" }} />
                <span style={{ width: "55%" }} />
              </div>
            </div>
          ) : (
            <div className="empty">
              <h3>Not checked yet</h3>
              <p>Press Check review to compare this review with your records. The result is saved, so it is never checked twice.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
