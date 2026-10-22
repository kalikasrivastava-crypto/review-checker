"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";
import { useApp, type Entry } from "./AppProvider";
import type { CheckResult, ReplyResponse, ReplyTone, ReviewItem } from "@/lib/types";

const APPROACHES: { value: ReplyTone; label: string; hint: string }[] = [
  { value: "apology", label: "Apologise and fix", hint: "For a genuine complaint" },
  { value: "factual", label: "Polite and factual", hint: "When we can't verify the visit" },
];

/** Genuine-looking complaints get an apology; anything we can't stand behind gets a factual reply. */
export const defaultApproach = (result: CheckResult): ReplyTone =>
  result.verdict === "Verified" || result.verdict === "Plausible" ? "apology" : "factual";

const keyFor = (approach: ReplyTone) => `${approach}|en|warm`;

export default function ReplyComposer({ review, entry, result }: { review: ReviewItem; entry: Entry; result: CheckResult }) {
  const { acquireAi, setReply, setStatus, toast } = useApp();
  const [approach, setApproach] = useState<ReplyTone>(() => defaultApproach(result));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const key = keyFor(approach);
  const draft = entry.replies?.[key];
  const hasPlaceholder = !!draft && /\[[^\]]+\]/.test(draft.text);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      // The free AI plan allows only a few calls a minute, so wait for our turn.
      await acquireAi();
      const r = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          review: { id: review.id, author: review.author, rating: review.rating, date: review.date, text: review.text },
          checks: result.checks,
          tone: approach,
        }),
      });
      const data = (await r.json()) as ReplyResponse;
      if (data.ok) setReply(review.id, key, { text: data.reply, warning: data.warning, at: new Date().toISOString() });
      else setError(data.error);
    } catch {
      setError("The connection failed. Try again.");
    }
    setLoading(false);
  }

  return (
    <section className="panel fade-in">
      <h2>Reply draft</h2>

      <div className="tone-switch" role="radiogroup" aria-label="Reply approach">
        {APPROACHES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={approach === t.value}
            className="tone-option"
            disabled={loading}
            onClick={() => {
              setApproach(t.value);
              setError(null);
            }}
          >
            <strong>{t.label}</strong>
            <span>{t.hint}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="skeleton" aria-label="Writing a reply">
          <span />
          <span />
          <span style={{ width: "70%" }} />
        </div>
      ) : (
        <>
          {error && <p className="notice notice-error">Couldn&apos;t draft a reply. {error}</p>}
          {draft ? (
            <>
              {draft.warning && <p className="notice notice-warning">{draft.warning}</p>}
              {hasPlaceholder && (
                <p className="notice notice-warning">
                  Replace the text in [square brackets] with your phone or email before posting.
                </p>
              )}
              <label className="sr-only" htmlFor={`reply-${review.id}`}>
                Reply draft
              </label>
              <textarea
                id={`reply-${review.id}`}
                value={draft.text}
                rows={6}
                onChange={(e) => setReply(review.id, key, { ...draft, text: e.target.value })}
              />
            </>
          ) : (
            !error && <p className="muted">No reply drafted yet. Drafting uses one AI call, and it is saved so you only pay for it once.</p>
          )}
          <div className="actions">
            <button type="button" className="btn btn-solid" onClick={generate}>
              {draft ? "Redraft" : "Draft reply"}
            </button>
            {draft && <CopyButton text={draft.text} />}
            {draft && (
              <button
                type="button"
                className="btn"
                disabled={entry.status === "replied"}
                onClick={() => {
                  setStatus(review.id, "replied");
                  toast("Marked as replied", "success");
                }}
              >
                {entry.status === "replied" ? "Marked as replied" : "Mark as replied"}
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
