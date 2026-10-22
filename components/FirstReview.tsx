"use client";

import { useState } from "react";
import Masthead from "./Masthead";
import { useApp } from "./AppProvider";
import { EXAMPLE_REVIEW } from "@/lib/demo";

const MIN_CHARS = 20;

/** Today as YYYY-MM-DD, read only when the owner clicks (never while rendering). */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Shown after setup: paste a review, or use an example to see a result at once. */
export default function FirstReview() {
  const { addReview, setTab, setSelectedId, skipFirstReview, settings } = useApp();
  const [text, setText] = useState("");
  const [rating, setRating] = useState("1");
  const [date, setDate] = useState("");
  const [author, setAuthor] = useState("");
  const [error, setError] = useState<string | null>(null);

  function go(r: { text: string; rating: number; date: string; author: string; claims?: typeof EXAMPLE_REVIEW.claims }) {
    const id = addReview(r, { check: true });
    setTab("inbox");
    setSelectedId(id);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setError("Paste a review first.");
    if (text.trim().length < MIN_CHARS) return setError("That's too short to check. Paste the whole review.");
    const usingExample = text.trim() === EXAMPLE_REVIEW.text;
    go({
      text,
      rating: Number(rating),
      date: date || today(),
      author: author.trim() || (usingExample ? EXAMPLE_REVIEW.author : ""),
      ...(usingExample ? { claims: EXAMPLE_REVIEW.claims } : {}),
    });
  }

  return (
    <div className="shell narrow-shell">
      <Masthead subtitle={`${settings?.name ? `${settings.name} · ` : ""}You're all set up. Now try it on a review.`} />

      <form className="panel first-review" onSubmit={submit}>
        <h2>Check your first review</h2>
        <p className="muted small">Copy a bad review from Google and paste it here. DineTrust compares what it claims with your records.</p>
        <label className="field">
          Review text
          <textarea
            value={text}
            rows={5}
            placeholder="e.g. “We were a table of 12 on Friday night and nobody served us for an hour…”"
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        <div className="form-row">
          <label className="field">
            Stars
            <select value={rating} onChange={(e) => setRating(e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} star{n === 1 ? "" : "s"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Date posted
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            <span className="field-help">Leave empty for today.</span>
          </label>
        </div>
        <label className="field">
          Reviewer name (optional)
          <input type="text" value={author} placeholder="e.g. Dan K." onChange={(e) => setAuthor(e.target.value)} />
        </label>
        {error && <p className="notice notice-error">{error}</p>}
        <div className="actions">
          <button type="submit" className="btn btn-solid">
            Check this review
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              go({ text: EXAMPLE_REVIEW.text, rating: EXAMPLE_REVIEW.rating, date: today(), author: EXAMPLE_REVIEW.author, claims: EXAMPLE_REVIEW.claims })
            }
          >
            Use an example review
          </button>
        </div>
        <p className="onboarding-shortcuts">
          <button type="button" className="link-button" onClick={skipFirstReview}>
            Skip, take me to the dashboard
          </button>
        </p>
      </form>
    </div>
  );
}
