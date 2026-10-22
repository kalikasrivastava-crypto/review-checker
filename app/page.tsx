"use client";

import { useState } from "react";
import reviewsData from "@/data/reviews.json";
import ReviewList from "@/components/ReviewList";
import ScoreCard from "@/components/ScoreCard";
import EvidenceTable from "@/components/EvidenceTable";
import ReplyEditor from "@/components/ReplyEditor";
import type { CheckResponse, CheckResult, Review, ReplyResponse } from "@/lib/types";

const SEEDED = reviewsData as Review[];

export default function Home() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [rating, setRating] = useState("1");

  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [checked, setChecked] = useState<Review | null>(null);

  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [warning, setWarning] = useState<string | undefined>();
  const [replyKey, setReplyKey] = useState(0);

  function clearResults() {
    setResult(null);
    setChecked(null);
    setError(null);
    setDraft("");
    setReplyError(null);
  }

  function pick(review: Review) {
    clearResults();
    setSelectedId(review.id ?? null);
    setText(review.text);
    setDate(review.date);
    setRating(String(review.rating));
  }

  function onPaste(value: string) {
    clearResults();
    setSelectedId(null);
    setText(value);
  }

  async function fetchReply(review: Review, res: CheckResult) {
    setReplyLoading(true);
    setReplyError(null);
    try {
      const r = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review, evidence: res.evidence }),
      });
      const data = (await r.json()) as ReplyResponse;
      if (data.ok) {
        setDraft(data.reply);
        setWarning(data.warning);
        setReplyKey((k) => k + 1);
      } else {
        setReplyError(data.error);
      }
    } catch {
      setReplyError("The connection failed. Try again.");
    }
    setReplyLoading(false);
  }

  async function check() {
    setChecking(true);
    setError(null);
    setResult(null);
    setChecked(null);
    setDraft("");
    setWarning(undefined);
    setReplyError(null);
    const review = {
      id: selectedId ?? undefined,
      text,
      date,
      rating: Number(rating),
    } as Review;
    try {
      const r = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(review),
      });
      const data = (await r.json()) as CheckResponse;
      if (data.ok) {
        setResult(data.result);
        setChecked(review);
        setChecking(false);
        void fetchReply(review, data.result);
        return;
      }
      setError(data.error);
    } catch {
      setError("The connection failed. Try again.");
    }
    setChecking(false);
  }

  return (
    <main className="layout">
      <aside className="left">
        <h1>Review Checker</h1>
        <p className="muted">Pick a review or paste one, then check it against your records.</p>
        <ReviewList reviews={SEEDED} selectedId={selectedId} onSelect={pick} />

        <h2>Paste a review</h2>
        <textarea
          value={text}
          rows={5}
          placeholder="Paste the review text here"
          onChange={(e) => onPaste(e.target.value)}
        />
        <div className="row">
          <label>
            Stars
            <select value={rating} onChange={(e) => setRating(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date posted
            <input
              type="datetime-local"
              value={date.slice(0, 16)}
              onChange={(e) => setDate(e.target.value)}
            />
          </label>
        </div>
        <button type="button" className="primary" onClick={check} disabled={checking}>
          {checking ? "Checking…" : "Check review"}
        </button>
      </aside>

      <section className="right">
        <p className="banner">AI-assisted – check before posting.</p>
        {error && <p className="error">{error}</p>}
        {!error && !result && !checking && (
          <p className="muted">Results will appear here.</p>
        )}
        {checking && <p className="muted">Reading the review…</p>}
        {result && checked && (
          <>
            <ScoreCard result={result} />
            <EvidenceTable evidence={result.evidence} />
            <ReplyEditor
              key={replyKey}
              loading={replyLoading}
              error={replyError}
              draft={draft}
              warning={warning}
              onChange={setDraft}
              onRetry={() => fetchReply(checked, result)}
            />
          </>
        )}
      </section>
    </main>
  );
}
