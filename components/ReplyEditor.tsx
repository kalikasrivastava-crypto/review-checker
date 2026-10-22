"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";
import type { ReplyTone } from "@/lib/types";

interface Props {
  loading: boolean;
  error: string | null;
  draft: string;
  warning?: string;
  tone: ReplyTone;
  onToneChange: (tone: ReplyTone) => void;
  onChange: (text: string) => void;
  onRetry: () => void;
}

const TONES: { value: ReplyTone; label: string; hint: string }[] = [
  { value: "apology", label: "Apologise and fix", hint: "For a genuine complaint" },
  { value: "factual", label: "Polite and factual", hint: "When we can't verify the visit" },
];

export default function ReplyEditor({
  loading,
  error,
  draft,
  warning,
  tone,
  onToneChange,
  onChange,
  onRetry,
}: Props) {
  const [approved, setApproved] = useState(false);
  const hasPlaceholder = /\[[^\]]+\]/.test(draft);

  return (
    <section className="panel fade-in">
      <h2>Reply draft</h2>

      <div className="tone-switch" role="radiogroup" aria-label="Reply tone">
        {TONES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={tone === t.value}
            className="tone-option"
            disabled={loading}
            onClick={() => tone !== t.value && onToneChange(t.value)}
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
      ) : error ? (
        <>
          <p className="notice notice-error">Couldn&apos;t draft a reply. {error}</p>
          <div className="actions">
            <button type="button" className="btn" onClick={onRetry}>
              Try again
            </button>
          </div>
        </>
      ) : (
        <>
          {warning && <p className="notice notice-warning">{warning}</p>}
          {hasPlaceholder && (
            <p className="notice notice-warning">
              Replace the text in [square brackets] with your phone or email before posting.
            </p>
          )}
          <label className="sr-only" htmlFor="reply-draft">
            Reply draft
          </label>
          <textarea
            id="reply-draft"
            value={draft}
            rows={6}
            onChange={(e) => {
              onChange(e.target.value);
              setApproved(false);
            }}
          />
          <div className="actions">
            <CopyButton text={draft} />
            <button
              type="button"
              className="btn"
              onClick={() => setApproved(true)}
              disabled={!draft.trim() || approved}
            >
              Approve
            </button>
            {approved && <span className="approved">Approved – ready to paste into Google</span>}
          </div>
        </>
      )}
    </section>
  );
}
