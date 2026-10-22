"use client";

import { useState } from "react";
import { useApp } from "./AppProvider";

const MIN_CHARS = 20;

/** Local date-time in the format a datetime-local input wants. */
function localNow(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AddReview({ onAdded }: { onAdded: (id: string) => void }) {
  const { addReview, toast } = useApp();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [rating, setRating] = useState("1");
  const [date, setDate] = useState("");
  const [author, setAuthor] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return setError("Paste a review first.");
    if (text.trim().length < MIN_CHARS) return setError("That's too short to check.");
    if (!date || Number.isNaN(new Date(date).getTime())) return setError("Add the date the review was posted.");
    const id = addReview({ text, rating: Number(rating), date, author });
    setText("");
    setAuthor("");
    setError(null);
    setOpen(false);
    toast("Review added to your inbox", "success");
    onAdded(id);
  }

  return (
    <details
      className="panel add-review"
      open={open}
      onToggle={(e) => {
        const isOpen = (e.currentTarget as HTMLDetailsElement).open;
        setOpen(isOpen);
        if (isOpen && !date) setDate(localNow());
      }}
    >
      <summary>Add a review</summary>
      <form onSubmit={submit} className="add-form">
        <label className="field">
          Review text
          <textarea
            value={text}
            rows={4}
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
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Date posted
            <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
        </div>
        <label className="field">
          Reviewer name (optional)
          <input type="text" value={author} placeholder="e.g. Dan K." onChange={(e) => setAuthor(e.target.value)} />
        </label>
        {error && <p className="notice notice-error">{error}</p>}
        <button type="submit" className="btn btn-primary">
          Add to inbox
        </button>
      </form>
    </details>
  );
}
