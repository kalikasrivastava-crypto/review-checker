"use client";

import { useMemo, useState } from "react";
import AddReview from "./AddReview";
import ReviewDetail from "./ReviewDetail";
import Stars from "./Stars";
import { EntryBadges } from "./Badges";
import { useApp, type Status } from "./AppProvider";
import { findBurst, isLowDetail } from "@/lib/patterns";
import type { ReviewItem, Verdict } from "@/lib/types";

type DateFilter = "all" | "week" | "month" | "custom";
interface Filters {
  status: Status | "all";
  rating: "all" | "low" | "1" | "2" | "3" | "4" | "5";
  verdict: Verdict | "all" | "unchecked";
  date: DateFilter;
  from: string;
  to: string;
  q: string;
}

const DEFAULT_FILTERS: Filters = { status: "all", rating: "all", verdict: "all", date: "all", from: "", to: "", q: "" };
const DAY_MS = 24 * 60 * 60 * 1000;

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

function initials(name: string): string {
  return (
    name
      .replace(/[^A-Za-z\s]/g, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?"
  );
}

export default function Inbox({ selectedId, onSelect }: { selectedId: string | null; onSelect: (id: string | null) => void }) {
  const { reviews, entries, entryOf, anchorDate, check, queue, insights } = useApp();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const burst = useMemo(() => findBurst(reviews), [reviews]);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => setFilters((f) => ({ ...f, [key]: value }));

  const visible = useMemo(() => {
    const end = anchorDate.getTime();
    const q = filters.q.trim().toLowerCase();
    return reviews.filter((r) => {
      const entry = entries[r.id];
      const status = entry?.status ?? "new";
      if (filters.status !== "all" && status !== filters.status) return false;
      if (filters.rating === "low" && r.rating > 2) return false;
      if (/^[1-5]$/.test(filters.rating) && r.rating !== Number(filters.rating)) return false;
      if (filters.verdict === "unchecked" && entry?.result) return false;
      if (filters.verdict !== "all" && filters.verdict !== "unchecked" && entry?.result?.verdict !== filters.verdict) return false;
      const t = new Date(r.date).getTime();
      if (filters.date === "week" && t <= end - 7 * DAY_MS) return false;
      if (filters.date === "month" && t <= end - 30 * DAY_MS) return false;
      if (filters.date === "custom") {
        if (filters.from && t < new Date(`${filters.from}T00:00:00`).getTime()) return false;
        if (filters.to && t > new Date(`${filters.to}T23:59:59`).getTime()) return false;
      }
      if (q && !`${r.author} ${r.text}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [reviews, entries, filters, anchorDate]);

  const filtersActive = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const visibleIds = visible.map((r) => r.id);
  const pickedVisible = visibleIds.filter((id) => picked.has(id));
  const allPicked = visibleIds.length > 0 && pickedVisible.length === visibleIds.length;
  const toCheck = pickedVisible.filter((id) => !entries[id]?.result);
  const queued = new Set(queue.ids);

  function toggle(id: string) {
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function tagsFor(r: ReviewItem): string[] {
    const tags: string[] = [];
    if (isLowDetail(r.text)) tags.push("Low detail");
    if (burst?.ids.has(r.id)) tags.push("Part of a burst");
    const like = insights?.similarOf[r.id];
    if (like) tags.push(`Looks like ${like.author}'s review`);
    return tags;
  }

  return (
    <div className={`inbox ${selectedId ? "has-detail" : ""}`}>
      <section className="inbox-list" aria-label="Reviews">
        <AddReview onAdded={(id) => onSelect(id)} />

        <div className="panel filters">
          <label className="field search">
            <span className="sr-only">Search reviews</span>
            <input
              type="search"
              placeholder="Search by name or words in the review"
              value={filters.q}
              onChange={(e) => set("q", e.target.value)}
            />
          </label>
          <div className="filter-grid">
            <label className="field">
              Status
              <select value={filters.status} onChange={(e) => set("status", e.target.value as Filters["status"])}>
                <option value="all">All</option>
                <option value="new">New</option>
                <option value="checked">Checked</option>
                <option value="replied">Replied</option>
                <option value="reported">Reported</option>
              </select>
            </label>
            <label className="field">
              Stars
              <select value={filters.rating} onChange={(e) => set("rating", e.target.value as Filters["rating"])}>
                <option value="all">All</option>
                <option value="low">1–2 stars</option>
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n} star{n === 1 ? "" : "s"}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Result
              <select value={filters.verdict} onChange={(e) => set("verdict", e.target.value as Filters["verdict"])}>
                <option value="all">All</option>
                <option value="unchecked">Not checked yet</option>
                <option value="Verified">Verified</option>
                <option value="Plausible">Plausible</option>
                <option value="Suspicious">Suspicious</option>
                <option value="Unverifiable">Unverifiable</option>
              </select>
            </label>
            <label className="field">
              Date
              <select value={filters.date} onChange={(e) => set("date", e.target.value as DateFilter)}>
                <option value="all">Any time</option>
                <option value="week">Last 7 days</option>
                <option value="month">Last 30 days</option>
                <option value="custom">Custom range…</option>
              </select>
            </label>
          </div>
          {filters.date === "custom" && (
            <div className="filter-grid">
              <label className="field">
                From
                <input type="date" value={filters.from} onChange={(e) => set("from", e.target.value)} />
              </label>
              <label className="field">
                To
                <input type="date" value={filters.to} onChange={(e) => set("to", e.target.value)} />
              </label>
            </div>
          )}
          <div className="filter-foot">
            <span className="muted small" aria-live="polite">
              {visible.length} of {reviews.length} reviews
            </span>
            {filtersActive && (
              <button type="button" className="btn btn-small" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Clear filters
              </button>
            )}
          </div>
        </div>

        <div className="bulk-bar">
          <label className="check-all">
            <input
              type="checkbox"
              checked={allPicked}
              disabled={visibleIds.length === 0}
              onChange={() => setPicked(allPicked ? new Set() : new Set(visibleIds))}
            />
            Select all shown
          </label>
          <button
            type="button"
            className="btn btn-solid btn-small"
            disabled={toCheck.length === 0 || queue.active}
            onClick={() => {
              check(toCheck);
              setPicked(new Set());
            }}
            title="Checks one review at a time to stay within the free AI limit"
          >
            {pickedVisible.length === 0
              ? "Check selected"
              : toCheck.length === 0
                ? "Already checked"
                : `Check ${toCheck.length} selected`}
          </button>
        </div>
        {pickedVisible.length > toCheck.length && toCheck.length > 0 && (
          <p className="muted small">
            {pickedVisible.length - toCheck.length} already checked, so they will be skipped.
          </p>
        )}

        {visible.length === 0 ? (
          <div className="empty">
            <h3>No reviews match</h3>
            <p>Try clearing a filter or searching for something else.</p>
          </div>
        ) : (
          <ul className="inbox-rows">
            {visible.map((r) => {
              const entry = entryOf(r.id);
              const tags = tagsFor(r);
              return (
                <li key={r.id} className={`inbox-row ${selectedId === r.id ? "selected" : ""}`}>
                  <input
                    type="checkbox"
                    aria-label={`Select review by ${r.author}`}
                    checked={picked.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                  <button type="button" className="row-button" aria-pressed={selectedId === r.id} onClick={() => onSelect(r.id)}>
                    <span className={`avatar avatar-${r.author.charCodeAt(0) % 4}`} aria-hidden="true">
                      {initials(r.author)}
                    </span>
                    <span className="row-body">
                      <span className="review-head">
                        <span className="review-author">{r.author}</span>
                        <Stars rating={r.rating} />
                        <span>{shortDate(r.date)}</span>
                      </span>
                      <span className="review-snippet">{r.text}</span>
                      <span className="tags">
                        <EntryBadges entry={entry} />
                        {queued.has(r.id) && <span className="tag">{queue.currentId === r.id ? "Checking…" : "Queued"}</span>}
                        {tags.map((t) => (
                          <span
                            key={t}
                            className={t === "Part of a burst" ? "tag tag-burst" : "tag"}
                            title={
                              t === "Part of a burst"
                                ? "Three or more 1-star reviews were posted within 24 hours of each other."
                                : t === "Low detail"
                                  ? "Strong feeling, but no names, dishes or times that could be checked."
                                  : undefined
                            }
                          >
                            {t}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="inbox-detail" aria-label="Review details">
        {selectedId ? (
          <ReviewDetail id={selectedId} onBack={() => onSelect(null)} />
        ) : (
          <div className="empty">
            <h2>Pick a review</h2>
            <p>Choose one from your inbox to check it against your records and draft a reply.</p>
          </div>
        )}
      </section>
    </div>
  );
}
