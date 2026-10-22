"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import reviewsData from "@/data/reviews.json";
import ReviewList from "@/components/ReviewList";
import ScoreCard from "@/components/ScoreCard";
import EvidenceTable from "@/components/EvidenceTable";
import ReplyEditor from "@/components/ReplyEditor";
import RemovalReport from "@/components/RemovalReport";
import RecordsPanel, { type CustomRecords } from "@/components/RecordsPanel";
import InsightsPanel from "@/components/InsightsPanel";
import { buildRemovalReport } from "@/lib/report";
import { findBurst, reviewTags, type Tag } from "@/lib/patterns";
import type { CheckResponse, CheckResult, Review, ReplyResponse, ReplyTone } from "@/lib/types";

const SEEDED = reviewsData as Review[];
const BURST = findBurst(SEEDED);
const TAGS: Record<string, Tag[]> = Object.fromEntries(
  SEEDED.map((r) => [r.id ?? "", reviewTags(r, BURST)]),
);

const STORAGE_KEY = "review-checker-records-v1";
function readSaved(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function subscribeStorage(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

const DEMO_COUNTS = { bills: 25, reservations: 10 };
type Tab = "checker" | "insights" | "records";
const TABS: { id: Tab; label: string }[] = [
  { id: "checker", label: "Checker" },
  { id: "insights", label: "Insights" },
  { id: "records", label: "Records" },
];

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

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
  const [tone, setTone] = useState<ReplyTone>("apology");
  const [tab, setTab] = useState<Tab>("checker");
  // Uploaded records live in this browser only. `session` holds this visit's change; before any change
  // we read what was saved earlier.
  const savedText = useSyncExternalStore(subscribeStorage, readSaved, () => null);
  const saved = useMemo<CustomRecords | null>(() => {
    try {
      return savedText ? (JSON.parse(savedText) as CustomRecords) : null;
    } catch {
      return null;
    }
  }, [savedText]);
  const [session, setSession] = useState<CustomRecords | null | undefined>(undefined);
  const custom = session !== undefined ? session : saved;

  function changeRecords(next: CustomRecords | null) {
    setSession(next);
    clearResults();
    try {
      if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // too large or blocked: the upload still works for this visit
    }
  }

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

  /** Genuine-looking complaints get an apology; anything we can't stand behind gets a factual reply. */
  const defaultTone = (res: CheckResult): ReplyTone =>
    res.verdict === "Verified" || res.verdict === "Plausible" ? "apology" : "factual";

  async function fetchReply(review: Review, res: CheckResult, replyTone: ReplyTone) {
    setReplyLoading(true);
    setReplyError(null);
    try {
      const r = await fetch("/api/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review, checks: res.checks, tone: replyTone }),
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
    clearResults();
    setWarning(undefined);
    const review = {
      id: selectedId ?? undefined,
      author: SEEDED.find((r) => r.id === selectedId)?.author,
      text,
      date,
      rating: Number(rating),
    } as Review;
    try {
      const r = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...review,
          ...(custom
            ? { records: { orders: custom.orders ?? [], reservations: custom.reservations ?? [] } }
            : {}),
        }),
      });
      const data = (await r.json()) as CheckResponse;
      if (data.ok) {
        setResult(data.result);
        setChecked(review);
        setChecking(false);
        const first = defaultTone(data.result);
        setTone(first);
        void fetchReply(review, data.result, first);
        return;
      }
      setError(data.error);
    } catch {
      setError("The connection failed. Try again.");
    }
    setChecking(false);
  }

  return (
    <div className="shell">
      <header className="masthead">
        <h1>DineTrust</h1>
        <p>Check a suspicious Google review against your own records, then reply calmly.</p>
      </header>

      <nav className="tabs" role="tablist" aria-label="Sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            className="tab"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        {custom && <span className="tab-note">Using your records</span>}
      </nav>

      {tab === "insights" && (
        <div role="tabpanel" id="panel-insights" aria-labelledby="tab-insights" className="narrow">
          <InsightsPanel custom={custom} />
        </div>
      )}

      {tab === "records" && (
        <div role="tabpanel" id="panel-records" aria-labelledby="tab-records" className="narrow">
          <RecordsPanel custom={custom} demoCounts={DEMO_COUNTS} onChange={changeRecords} />
        </div>
      )}

      <main className="layout" hidden={tab !== "checker"} role="tabpanel" id="panel-checker" aria-labelledby="tab-checker">
        <section aria-labelledby="reviews-title">
          <h2 className="section-title" id="reviews-title">
            Recent reviews
          </h2>
          {BURST && (
            <p className="notice notice-warning burst-banner" role="status">
              <strong>Possible burst.</strong> {BURST.count} reviews of 1–2 stars landed within 72 hours of each
              other ({day(BURST.from)}–{day(BURST.to)}). Check each one against your records before replying.
            </p>
          )}
          <ReviewList reviews={SEEDED} selectedId={selectedId} tags={TAGS} onSelect={pick} />
        </section>

        <section aria-label="Checker">
          <div className="panel">
            <h2>Review to check</h2>
            <label className="field">
              Pick one from the list, or paste a review here
              <textarea
                value={text}
                rows={5}
                placeholder="Paste the review text"
                onChange={(e) => onPaste(e.target.value)}
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
                <input
                  type="datetime-local"
                  value={date.slice(0, 16)}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
            </div>
            <button type="button" className="btn btn-primary" onClick={check} disabled={checking}>
              {checking ? "Checking…" : "Check review"}
            </button>
          </div>

          {error && (
            <p className="notice notice-error fade-in" role="alert">
              {error}
            </p>
          )}

          {checking && (
            <div className="panel" aria-label="Checking the review">
              <div className="skeleton">
                <span className="skeleton-stamp" />
                <span />
                <span style={{ width: "75%" }} />
                <span style={{ width: "55%" }} />
              </div>
            </div>
          )}

          {!error && !result && !checking && (
            <div className="empty">
              <h2>No review checked yet</h2>
              <p>Pick a review on the left, or paste one above, then press Check review.</p>
            </div>
          )}

          {result && checked && (
            <>
              <ScoreCard result={result} />
              <EvidenceTable checks={result.checks} />
              <ReplyEditor
                key={replyKey}
                loading={replyLoading}
                error={replyError}
                draft={draft}
                warning={warning}
                tone={tone}
                onToneChange={(t) => {
                  setTone(t);
                  void fetchReply(checked, result, t);
                }}
                onChange={setDraft}
                onRetry={() => fetchReply(checked, result, tone)}
              />
              {result.verdict === "Suspicious" && (
                <RemovalReport
                  key={`${checked.date}-${checked.text.length}`}
                  initial={buildRemovalReport(checked, result)}
                />
              )}
            </>
          )}
        </section>
      </main>

      <p className="footer-note">AI-assisted – check before posting.</p>
    </div>
  );
}
