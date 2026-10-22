"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";
import { useApp, type Entry } from "./AppProvider";
import { templateReply } from "@/lib/reply-templates";
import { contactText } from "@/lib/settings";
import type { CheckResult, ReplyApproach, ReplyLanguage, ReplyResponse, ReplyStyle, ReviewItem } from "@/lib/types";
import { riskLevel } from "@/lib/risk";

export const APPROACHES: { value: ReplyApproach; label: string; hint: string }[] = [
  { value: "apology", label: "Apologise and fix", hint: "A fair complaint" },
  { value: "contact", label: "Ask them to contact us", hint: "We can't confirm it" },
  { value: "factual", label: "Polite and factual", hint: "We found no such visit" },
];

const LANGUAGES: { value: ReplyLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "hi", label: "हिन्दी" },
  { value: "hinglish", label: "Hinglish" },
];

const STYLES: { value: ReplyStyle; label: string }[] = [
  { value: "warm", label: "Warm" },
  { value: "professional", label: "Professional" },
  { value: "short", label: "Short" },
];

/** Low risk: apologise. Medium: invite them to get in touch. High: stay polite and factual. */
export const defaultApproach = (result: CheckResult): ReplyApproach => {
  const risk = riskLevel(result);
  return risk === "low" ? "apology" : risk === "medium" ? "contact" : "factual";
};

const keyFor = (approach: ReplyApproach, language: ReplyLanguage, style: ReplyStyle) => `${approach}|${language}|${style}`;

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled: boolean;
}) {
  return (
    <div className="segmented-group">
      <span className="segmented-label" id={`seg-${label}`}>
        {label}
      </span>
      <div className="segmented" role="radiogroup" aria-labelledby={`seg-${label}`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className="segment"
            disabled={disabled}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ReplyComposer({
  review,
  entry,
  result,
  approach,
  onApproachChange,
}: {
  review: ReviewItem;
  entry: Entry;
  result: CheckResult;
  approach: ReplyApproach;
  onApproachChange: (a: ReplyApproach) => void;
}) {
  const { acquireAi, setReply, settings, toast } = useApp();
  const [language, setLanguage] = useState<ReplyLanguage>("en");
  const [style, setStyle] = useState<ReplyStyle>("warm");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const contact = contactText(settings);
  const key = keyFor(approach, language, style);
  const saved = entry.replies?.[key];
  // A ready-made reply is always available, with no AI call. Saved or AI-tailored text replaces it.
  const text = saved?.text ?? templateReply({ approach, language, style, contact });
  const source = saved?.source === "ai" ? "ai" : saved ? "own" : "template";
  const hasPlaceholder = /\[[^\]]+\]/.test(text);

  async function tailor() {
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
          approach,
          language,
          style,
          contact,
        }),
      });
      const data = (await r.json()) as ReplyResponse;
      if (data.ok) {
        setReply(review.id, key, { text: data.reply, warning: data.warning, at: new Date().toISOString(), source: "ai" });
        toast("Tailored reply ready", "success");
      } else setError(data.error);
    } catch {
      setError("The connection failed. Try again.");
    }
    setLoading(false);
  }

  return (
    <div className="composer" id={`composer-${review.id}`}>
      <h3 className="composer-title">Your reply</h3>

      <div className="tone-switch three" role="radiogroup" aria-label="Reply approach">
        {APPROACHES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={approach === t.value}
            className="tone-option"
            disabled={loading}
            onClick={() => {
              onApproachChange(t.value);
              setError(null);
            }}
          >
            <strong>{t.label}</strong>
            <span>{t.hint}</span>
          </button>
        ))}
      </div>

      <div className="pickers">
        <Segmented label="Language" options={LANGUAGES} value={language} onChange={(v) => { setLanguage(v); setError(null); }} disabled={loading} />
        <Segmented label="Tone" options={STYLES} value={style} onChange={(v) => { setStyle(v); setError(null); }} disabled={loading} />
      </div>

      {loading ? (
        <div className="skeleton" aria-label="Writing a reply">
          <span />
          <span />
          <span style={{ width: "70%" }} />
        </div>
      ) : (
        <>
          {error && <p className="notice notice-error">Couldn&apos;t tailor the reply. {error}</p>}
          {saved?.warning && <p className="notice notice-warning">{saved.warning}</p>}
          {hasPlaceholder && (
            <p className="notice notice-warning">
              {settings && (settings.phone || settings.email)
                ? "Replace the text in [square brackets] before posting."
                : "Add your phone or email in My Restaurant, or replace the text in [square brackets] before posting."}
            </p>
          )}
          <label className="sr-only" htmlFor={`reply-${review.id}`}>
            Reply draft
          </label>
          <textarea
            id={`reply-${review.id}`}
            lang={language === "hi" ? "hi" : "en"}
            value={text}
            rows={5}
            placeholder="Your reply will appear here. You can edit it before you copy it."
            onChange={(e) => setReply(review.id, key, { text: e.target.value, at: new Date().toISOString(), source: "own" })}
          />
          <p className="draft-source muted small">
            {source === "ai" ? "Tailored to this review by the AI." : source === "own" ? "Your edited draft." : "Ready-made draft. No AI used."}
          </p>
          <div className="actions">
            <CopyButton text={text} label="Copy reply" />
            <button type="button" className="btn" onClick={tailor}>
              {source === "ai" ? "Tailor again with AI" : "Tailor to this review with AI"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
