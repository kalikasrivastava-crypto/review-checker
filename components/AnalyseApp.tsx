"use client";

import { useMemo, useState } from "react";
import AnalysisResults from "./AnalysisResults";
import { analyseReviews } from "@/lib/analysis";
import {
  buildReviews,
  MAX_FILE_BYTES,
  MAX_REVIEWS,
  readReviewFile,
  type ReviewColumns,
} from "@/lib/review-csv";

interface Source {
  kind: "sample" | "upload";
  name: string;
  headers: string[];
  rows: string[][];
  columns: ReviewColumns;
}

const FIELDS: { field: keyof ReviewColumns; label: string }[] = [
  { field: "text", label: "Review text (required)" },
  { field: "rating", label: "Rating (optional)" },
  { field: "date", label: "Date (optional)" },
  { field: "reviewer", label: "Reviewer name (optional)" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const niceDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const were = (n: number) => (n === 1 ? "was" : "were");
const have = (n: number) => (n === 1 ? "has" : "have");
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

export default function AnalyseApp() {
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const result = useMemo(
    () => (source && source.columns.text !== undefined ? buildReviews(source.rows, source.columns) : null),
    [source],
  );

  function load(kind: Source["kind"], name: string, text: string) {
    const file = readReviewFile(text);
    if (file.headers.length === 0 || file.rows.length === 0) {
      setError("That file has no reviews in it. It needs a header row and at least one review underneath.");
      return;
    }
    if (file.rows.length > MAX_REVIEWS) {
      setError(`That file has ${file.rows.length.toLocaleString()} rows. The limit is ${MAX_REVIEWS.toLocaleString()}. Try a shorter date range.`);
      return;
    }
    setError(null);
    setSource({ kind, name, headers: file.headers, rows: file.rows, columns: file.guess });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("That file is over 3 MB. Try a shorter date range.");
      return;
    }
    try {
      load("upload", file.name, await file.text());
    } catch {
      setError("Couldn't read that file. Is it a CSV?");
    }
  }

  async function useSample() {
    setLoading(true);
    try {
      const res = await fetch("/sample-reviews.csv");
      if (!res.ok) throw new Error("missing");
      load("sample", "sample-reviews.csv", await res.text());
    } catch {
      setError("Couldn't load the sample data. Check your connection and try again.");
    }
    setLoading(false);
  }

  const analysis = useMemo(() => (result && result.reviews.length > 0 ? analyseReviews(result.reviews) : null), [result]);
  const s = result?.summary;
  const withRating = s ? s.used - s.ratingMissing - s.ratingUnreadable : 0;
  const textMissing = !!source && source.columns.text === undefined;

  return (
    <div className="stack">
      <section className="panel">
        <h2>Add your reviews</h2>
        <p className="muted small">
          Upload a CSV file with one review per row. Only the review text is needed. A rating, a date and a reviewer name make the
          results richer.
        </p>
        <div className="table-scroll">
          <table className="column-guide">
            <thead>
              <tr>
                <th scope="col">Column name</th>
                <th scope="col">What it means</th>
                <th scope="col">Example</th>
                <th scope="col">Needed?</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <code>review_text</code>
                </td>
                <td>The full review</td>
                <td>Food was cold and service was slow</td>
                <td>
                  <span className="req">required</span>
                </td>
              </tr>
              <tr>
                <td>
                  <code>rating</code>
                </td>
                <td>Stars, 1 to 5</td>
                <td>2</td>
                <td>
                  <span className="req req-opt">optional</span>
                </td>
              </tr>
              <tr>
                <td>
                  <code>date</code>
                </td>
                <td>When it was posted</td>
                <td>2026-10-17</td>
                <td>
                  <span className="req req-opt">optional</span>
                </td>
              </tr>
              <tr>
                <td>
                  <code>reviewer</code>
                </td>
                <td>Who wrote it</td>
                <td>Asha K.</td>
                <td>
                  <span className="req req-opt">optional</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <label className="field">
          Upload your reviews file (CSV)
          <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
        <div className="actions">
          <button type="button" className="btn btn-primary" onClick={useSample} disabled={loading}>
            {loading ? "Loading…" : "Use the sample data"}
          </button>
          <a className="btn btn-small" href="/dinetrust-reviews-template.csv" download>
            Download CSV template
          </a>
        </div>
        <p className="muted small">Your file is read in your browser. It isn&apos;t uploaded or saved anywhere.</p>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
      </section>

      {source && (
        <section className="panel" aria-live="polite">
          <h2>What we read</h2>
          {source.kind === "sample" && (
            <p className="notice notice-warning sample-banner">
              <strong>Sample data.</strong> {s ? plural(s.used, "made-up review") : "Made-up reviews"}, not from a real restaurant. Everything
              below is only here to show how DineTrust works.
            </p>
          )}
          <p className="muted small">
            Source: {source.kind === "sample" ? "built-in sample data" : `your file, ${source.name}`}
          </p>

          <details className="mapping-details" open={textMissing}>
            <summary>{textMissing ? "Tell us which column holds the review text" : "Columns matched. Change them if something looks wrong"}</summary>
            <div className="mapping-grid">
              {FIELDS.map(({ field, label }) => (
                <label className="field" key={field}>
                  {label}
                  <select
                    value={source.columns[field] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSource((cur) => {
                        if (!cur) return cur;
                        const next = { ...cur.columns };
                        if (v === "") delete next[field];
                        else next[field] = Number(v);
                        return { ...cur, columns: next };
                      });
                    }}
                  >
                    <option value="">— none —</option>
                    {source.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h || `Column ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </details>

          {textMissing && (
            <p className="notice notice-warning">We couldn&apos;t tell which column holds the review text. Pick it above to continue.</p>
          )}

          {s && (
            <>
              <dl className="dq-list">
                <div>
                  <dt>Rows read</dt>
                  <dd>{s.rowsRead.toLocaleString()}</dd>
                </div>
                <div className="dq-main">
                  <dt>Reviews used</dt>
                  <dd>{s.used.toLocaleString()}</dd>
                </div>
                {s.dateFrom && s.dateTo && (
                  <div>
                    <dt>Dates covered</dt>
                    <dd>
                      {niceDate(s.dateFrom)} to {niceDate(s.dateTo)}
                    </dd>
                  </div>
                )}
                <div>
                  <dt>With a rating</dt>
                  <dd>{withRating.toLocaleString()}</dd>
                </div>
              </dl>

              {s.used === 0 && (
                <p className="notice notice-warning">None of the rows could be used as reviews. Check that the right column is picked above.</p>
              )}

              {(s.skippedEmpty > 0 || s.skippedShort > 0 || s.duplicates > 0 || s.ratingMissing + s.ratingUnreadable > 0 || s.dateMissing + s.dateUnreadable > 0) && (
                <div className="notice notice-warning">
                  <strong>Things we skipped or ignored:</strong>
                  <ul className="issue-list">
                    {s.skippedEmpty > 0 && <li>{plural(s.skippedEmpty, "row")} with no review text {were(s.skippedEmpty)} skipped.</li>}
                    {s.skippedShort > 0 && <li>{plural(s.skippedShort, "review")} too short to say anything (under 10 letters) {were(s.skippedShort)} skipped.</li>}
                    {s.duplicates > 0 && <li>{plural(s.duplicates, "duplicate")} of a review already counted {were(s.duplicates)} removed.</li>}
                    {s.ratingMissing > 0 && <li>{plural(s.ratingMissing, "review")} {have(s.ratingMissing)} no rating.</li>}
                    {s.ratingUnreadable > 0 && <li>{plural(s.ratingUnreadable, "rating")} couldn&apos;t be read (use a number from 1 to 5), so {s.ratingUnreadable === 1 ? "it is" : "they are"} ignored.</li>}
                    {s.dateMissing > 0 && <li>{plural(s.dateMissing, "review")} {have(s.dateMissing)} no date.</li>}
                    {s.dateUnreadable > 0 && <li>{plural(s.dateUnreadable, "date")} couldn&apos;t be read (try 2026-10-17), so {s.dateUnreadable === 1 ? "it is" : "they are"} ignored.</li>}
                  </ul>
                </div>
              )}

              {result && result.reviews.length > 0 && (
                <>
                  <p className="muted small">The first {Math.min(5, result.reviews.length)} reviews we will analyse:</p>
                  <div className="table-scroll">
                    <table className="column-guide">
                      <thead>
                        <tr>
                          <th scope="col">Rating</th>
                          <th scope="col">Date</th>
                          <th scope="col">Review</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.reviews.slice(0, 5).map((r, i) => (
                          <tr key={i}>
                            <td>{r.rating ?? "–"}</td>
                            <td>{r.date ? niceDate(r.date) : "–"}</td>
                            <td>{r.text.length > 140 ? `${r.text.slice(0, 140)}…` : r.text}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </>
          )}

          <div className="actions">
            <button
              type="button"
              className="btn btn-small"
              onClick={() => {
                setSource(null);
                setError(null);
              }}
            >
              Start over with a different file
            </button>
          </div>
        </section>
      )}

      {source && analysis && <AnalysisResults analysis={analysis} isSample={source.kind === "sample"} />}
    </div>
  );
}
