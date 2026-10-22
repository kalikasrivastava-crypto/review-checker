"use client";

import { useRef, useState } from "react";
import { IconAlert, IconCheck, IconFile, IconUpload } from "../UiIcons";
import { MAX_FILE_BYTES, MAX_REVIEWS, type ParseSummary, type ParsedReview, type ReviewColumns } from "@/lib/review-csv";
import { fileSize, niceDate, plural } from "@/lib/format";

export interface UploadSource {
  kind: "sample" | "upload";
  name: string;
  size: number | null;
  headers: string[];
  columns: ReviewColumns;
}

export interface Busy {
  name: string;
  stage: "reading" | "checking";
  progress: number;
}

const FIELDS: { field: keyof ReviewColumns; label: string }[] = [
  { field: "text", label: "Review text (required)" },
  { field: "rating", label: "Rating (optional)" },
  { field: "date", label: "Date (optional)" },
  { field: "reviewer", label: "Reviewer name (optional)" },
];

interface Props {
  source: UploadSource | null;
  parsed: { reviews: ParsedReview[]; summary: ParseSummary } | null;
  error: string | null;
  busy: Busy | null;
  onFile: (file: File) => void;
  onSample: () => void;
  onClear: () => void;
  onColumn: (field: keyof ReviewColumns, value: number | null) => void;
  onViewResults: () => void;
}

export default function UploadView({ source, parsed, error, busy, onFile, onSample, onClear, onColumn, onViewResults }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const s = parsed?.summary;
  const textMissing = !!source && source.columns.text === undefined;
  const headerOf = (i: number | undefined) => (i === undefined || !source ? null : source.headers[i] || `Column ${i + 1}`);
  const withRating = s ? s.used - s.ratingMissing - s.ratingUnreadable : 0;
  const withDate = s ? s.used - s.dateMissing - s.dateUnreadable : 0;
  const skipped = s ? s.skippedEmpty + s.skippedShort + s.duplicates : 0;

  return (
    <div className="stack-16">
      <header className="page-head">
        <div>
          <h1>Upload reviews</h1>
          <p>Add a CSV file of customer reviews. Your file is read in this browser tab and is never uploaded or saved.</p>
        </div>
      </header>

      {error && (
        <div className="alert alert--error" role="alert">
          <IconAlert />
          <p>
            {error}
            {source && " Your earlier reviews are still loaded."}
          </p>
        </div>
      )}

      <section className="card card--pad" aria-labelledby="drop-title">
        <h2 id="drop-title" className="sr-only">
          Choose a file
        </h2>
        <label
          className={`dropzone${dragging ? " dropzone--active" : ""}`}
          aria-busy={!!busy}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragEnter={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files?.[0];
            if (file && !busy) onFile(file);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            disabled={!!busy}
            onChange={(e) => {
              const input = e.currentTarget;
              const file = input.files?.[0];
              if (file) onFile(file);
              input.value = ""; // so the same file can be chosen again
            }}
          />
          <IconUpload />
          <strong>Drag and drop your CSV file here</strong>
          <span>or</span>
          <span className="button button--secondary">Choose a file</span>
          <span>
            CSV, up to {fileSize(MAX_FILE_BYTES)} and {MAX_REVIEWS.toLocaleString()} reviews
          </span>
        </label>

        {busy && (
          <div className="or-row" role="status" aria-live="polite">
            <div style={{ flex: 1, minWidth: 220 }}>
              <p>
                {busy.stage === "reading" ? `Reading ${busy.name}… ${busy.progress}%` : `Checking ${busy.name}…`}
              </p>
              <div className="meter" style={{ marginTop: 8 }} aria-hidden="true">
                <span style={{ width: `${busy.stage === "checking" ? 100 : busy.progress}%` }} />
              </div>
            </div>
          </div>
        )}

        <div className="or-row">
          <p>No file handy? Try the built-in sample data (made-up reviews).</p>
          <button type="button" className="button button--secondary" onClick={onSample} disabled={!!busy}>
            Use sample data
          </button>
        </div>
      </section>

      {source && s && (
        <section className="card card--pad" aria-labelledby="check-title">
          <div className="card__head">
            <h2 id="check-title">Check your file</h2>
            {source.kind === "sample" ? <span className="badge badge--sample">Sample data</span> : <span className="badge badge--accent">Your file</span>}
          </div>
          <div className="file-line">
            <IconFile />
            <strong>{source.name}</strong>
            <span className="muted">
              {source.size !== null && `${fileSize(source.size)} · `}
              {plural(s.rowsRead, "row")} read
            </span>
          </div>

          <ul className="checklist">
            <li className={source.columns.text !== undefined ? "ok" : "warn"}>
              {source.columns.text !== undefined ? <IconCheck /> : <IconAlert />}
              <span>{source.columns.text !== undefined ? `Review text found in “${headerOf(source.columns.text)}”` : "Review text column not found"}</span>
              <small>required</small>
            </li>
            <li className={source.columns.rating !== undefined ? "ok" : "off"}>
              {source.columns.rating !== undefined ? <IconCheck /> : <IconAlert />}
              <span>
                {source.columns.rating !== undefined
                  ? `Ratings found in “${headerOf(source.columns.rating)}” (${plural(withRating, "review")} with a valid rating)`
                  : "No rating column. Results will not include an average rating."}
              </span>
              <small>optional</small>
            </li>
            <li className={source.columns.date !== undefined ? "ok" : "off"}>
              {source.columns.date !== undefined ? <IconCheck /> : <IconAlert />}
              <span>
                {source.columns.date !== undefined
                  ? `Dates found in “${headerOf(source.columns.date)}” (${plural(withDate, "review")} with a valid date${s.dateFrom && s.dateTo ? `, ${niceDate(s.dateFrom)} to ${niceDate(s.dateTo)}` : ""})`
                  : "No date column."}
              </span>
              <small>optional</small>
            </li>
            <li className={s.used > 0 ? "ok" : "warn"}>
              {s.used > 0 ? <IconCheck /> : <IconAlert />}
              <span>
                <strong>{plural(s.used, "review")}</strong> ready to analyse{skipped > 0 ? `, ${plural(skipped, "row")} skipped` : ""}
              </span>
            </li>
          </ul>

          {textMissing && (
            <div className="alert alert--warning" style={{ marginTop: 14 }}>
              <IconAlert />
              <p>We couldn&apos;t tell which column holds the review text. Pick it under “Match columns” below to continue.</p>
            </div>
          )}

          {(skipped > 0 || s.ratingMissing + s.ratingUnreadable > 0 || s.dateMissing + s.dateUnreadable > 0) && s.used > 0 && (
            <div className="alert alert--warning" style={{ marginTop: 14 }}>
              <IconAlert />
              <div>
                <p>
                  <strong>Skipped or ignored:</strong>
                </p>
                <ul>
                  {s.skippedEmpty > 0 && <li>{plural(s.skippedEmpty, "row")} with no review text {s.skippedEmpty === 1 ? "was" : "were"} skipped.</li>}
                  {s.skippedShort > 0 && <li>{plural(s.skippedShort, "review")} too short to say anything (under 10 letters) {s.skippedShort === 1 ? "was" : "were"} skipped.</li>}
                  {s.duplicates > 0 && <li>{plural(s.duplicates, "duplicate")} of a review already counted {s.duplicates === 1 ? "was" : "were"} removed.</li>}
                  {s.ratingMissing > 0 && <li>{plural(s.ratingMissing, "review")} {s.ratingMissing === 1 ? "has" : "have"} no rating.</li>}
                  {s.ratingUnreadable > 0 && <li>{plural(s.ratingUnreadable, "rating")} couldn&apos;t be read (use a number from 1 to 5), so {s.ratingUnreadable === 1 ? "it is" : "they are"} ignored.</li>}
                  {s.dateMissing > 0 && <li>{plural(s.dateMissing, "review")} {s.dateMissing === 1 ? "has" : "have"} no date.</li>}
                  {s.dateUnreadable > 0 && <li>{plural(s.dateUnreadable, "date")} couldn&apos;t be read (try 2026-10-17), so {s.dateUnreadable === 1 ? "it is" : "they are"} ignored.</li>}
                </ul>
              </div>
            </div>
          )}

          <details className="details" style={{ marginTop: 16 }} open={textMissing}>
            <summary>Match columns</summary>
            <div className="details-body form-grid">
              {FIELDS.map(({ field, label }) => (
                <label key={field}>
                  {label}
                  <select value={source.columns[field] ?? ""} onChange={(e) => onColumn(field, e.target.value === "" ? null : Number(e.target.value))}>
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

          {parsed && parsed.reviews.length > 0 && (
            <>
              <h3 className="card__title" style={{ margin: "18px 0 8px" }}>
                Preview
              </h3>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Rating</th>
                      <th scope="col">Date</th>
                      <th scope="col">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.reviews.slice(0, 5).map((r, i) => (
                      <tr key={i}>
                        <td>{r.rating ?? "–"}</td>
                        <td>{r.date ? niceDate(r.date) : "–"}</td>
                        <td>{r.text.length > 140 ? `${r.text.slice(0, 140)}…` : r.text}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="card__sub">The first {Math.min(5, parsed.reviews.length)} of {s.used.toLocaleString()} reviews.</p>
            </>
          )}

          <div className="actions-row">
            <button type="button" className="button button--primary" onClick={onViewResults} disabled={!parsed || parsed.reviews.length === 0}>
              View results
            </button>
            <button type="button" className="button button--secondary" onClick={onClear}>
              Start over
            </button>
          </div>
        </section>
      )}

      <section className="card card--pad" aria-labelledby="format-title">
        <div className="card__head">
          <h2 id="format-title">Accepted file format</h2>
          <a className="button button--secondary button--sm" href="/dinetrust-reviews-template.csv" download>
            Download CSV template
          </a>
        </div>
        <p className="card__sub" style={{ marginBottom: 12 }}>
          One review per row, with a header row on top. Only the review text is required. Files saved with commas, semicolons or tabs all work.
        </p>
        <div className="table-wrap">
          <table className="data-table">
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
                  <span className="badge badge--accent">Required</span>
                </td>
              </tr>
              <tr>
                <td>
                  <code>rating</code>
                </td>
                <td>Stars, 1 to 5</td>
                <td>2</td>
                <td>
                  <span className="badge">Optional</span>
                </td>
              </tr>
              <tr>
                <td>
                  <code>date</code>
                </td>
                <td>When it was posted</td>
                <td>2026-10-17</td>
                <td>
                  <span className="badge">Optional</span>
                </td>
              </tr>
              <tr>
                <td>
                  <code>reviewer</code>
                </td>
                <td>Who wrote it</td>
                <td>Asha K.</td>
                <td>
                  <span className="badge">Optional</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="card__sub" style={{ marginTop: 12 }}>
          Using Excel or Google Sheets? Choose File, then Save as or Download, then CSV. Copied your reviews from Google? Paste them into a sheet
          under a <code>review_text</code> heading first.
        </p>
      </section>
    </div>
  );
}
