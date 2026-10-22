import { detectDelimiter, parseCsv } from "./csv";
import { normalizeDate } from "./records";

/** One review, cleaned up and ready to analyse. */
export interface ParsedReview {
  text: string;
  rating: number | null; // 1 to 5, or null when the file has none (or it can't be read)
  date: string | null; // YYYY-MM-DD, or null
  reviewer: string | null;
}

/** Which column (0, 1, 2...) holds each field. Only the review text is required. */
export interface ReviewColumns {
  text?: number;
  rating?: number;
  date?: number;
  reviewer?: number;
}

/** Every number here is a count taken from the file itself. */
export interface ParseSummary {
  rowsRead: number;
  used: number;
  skippedEmpty: number;
  skippedShort: number;
  duplicates: number;
  ratingMissing: number;
  ratingUnreadable: number;
  dateMissing: number;
  dateUnreadable: number;
  dateFrom: string | null;
  dateTo: string | null;
}

export interface ReviewFile {
  headers: string[];
  rows: string[][];
  guess: ReviewColumns;
}

export const MAX_REVIEWS = 5000;
export const MAX_FILE_BYTES = 3 * 1024 * 1024;
/** A review needs at least this many letters to say anything about the visit. */
export const MIN_LETTERS = 10;

const GUESSES: [keyof ReviewColumns, RegExp][] = [
  ["text", /^(?!.*reviewer).*(review|comment|feedback|text|message|remark|opinion|description|body|content)/i],
  ["rating", /rating|stars?|score|grade/i],
  ["date", /date|posted|when|time|day/i],
  ["reviewer", /reviewer|author|name|customer|user|guest/i],
];

/** Reads the file's text into headers and rows and guesses which column is which, from the header names. */
export function readReviewFile(text: string): ReviewFile {
  const [headers = [], ...rows] = parseCsv(text, detectDelimiter(text));
  const cleaned = headers.map((h) => h.trim());
  const guess: ReviewColumns = {};
  const used = new Set<number>();
  for (const [field, re] of GUESSES) {
    // The exact column name wins over a looser match ("review_text" before "reviewer").
    const exact = cleaned.findIndex((h, i) => !used.has(i) && h.toLowerCase().replace(/[\s-]+/g, "_") === (field === "text" ? "review_text" : field));
    const idx = exact !== -1 ? exact : cleaned.findIndex((h, i) => !used.has(i) && re.test(h));
    if (idx !== -1) {
      guess[field] = idx;
      used.add(idx);
    }
  }
  return { headers: cleaned, rows, guess };
}

/** "4", "4.0", "4/5", "4 stars", "★★★★" all give 4. Anything else, or a number outside 1 to 5, is unreadable. */
export function parseRating(raw: string): number | null {
  const v = raw.trim();
  if (!v) return null;
  const stars = (v.match(/[★⭐]/g) ?? []).length;
  if (stars >= 1 && stars <= 5 && !/\d/.test(v)) return stars;
  const m = /^(\d+(?:[.,]\d+)?)\s*(?:\/\s*5|stars?|out of 5)?$/i.exec(v);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return n >= 1 && n <= 5 ? Math.round(n * 2) / 2 : null;
}

/** Accepts the usual date styles, plus words like "Oct 5, 2026". */
export function parseDate(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const direct = normalizeDate(v);
  if (direct) return direct;
  if (/[A-Za-z]{3}/.test(v)) {
    const t = Date.parse(v);
    if (!Number.isNaN(t)) {
      const d = new Date(t);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }
  }
  return null;
}

const letters = (s: string) => (s.match(/\p{L}/gu) ?? []).length;
const dupKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").replace(/[\s.!?,;:]+$/g, "").trim();

/** Cleans the rows into reviews and counts everything that was skipped or ignored, so nothing is hidden. */
export function buildReviews(rows: string[][], columns: ReviewColumns): { reviews: ParsedReview[]; summary: ParseSummary } {
  const summary: ParseSummary = {
    rowsRead: rows.length,
    used: 0,
    skippedEmpty: 0,
    skippedShort: 0,
    duplicates: 0,
    ratingMissing: 0,
    ratingUnreadable: 0,
    dateMissing: 0,
    dateUnreadable: 0,
    dateFrom: null,
    dateTo: null,
  };
  const reviews: ParsedReview[] = [];
  const seen = new Set<string>();
  const cell = (row: string[], i: number | undefined) => (i === undefined ? "" : (row[i] ?? "").trim());

  for (const row of rows) {
    const text = cell(row, columns.text).replace(/\s+/g, " ");
    if (!text) {
      summary.skippedEmpty++;
      continue;
    }
    if (letters(text) < MIN_LETTERS) {
      summary.skippedShort++;
      continue;
    }
    const key = dupKey(text);
    if (seen.has(key)) {
      summary.duplicates++;
      continue;
    }
    seen.add(key);

    const ratingRaw = cell(row, columns.rating);
    const rating = parseRating(ratingRaw);
    if (rating === null) {
      if (ratingRaw) summary.ratingUnreadable++;
      else summary.ratingMissing++;
    }
    const dateRaw = cell(row, columns.date);
    const date = parseDate(dateRaw);
    if (date === null) {
      if (dateRaw) summary.dateUnreadable++;
      else summary.dateMissing++;
    } else {
      if (!summary.dateFrom || date < summary.dateFrom) summary.dateFrom = date;
      if (!summary.dateTo || date > summary.dateTo) summary.dateTo = date;
    }
    reviews.push({ text, rating, date, reviewer: cell(row, columns.reviewer) || null });
  }
  summary.used = reviews.length;
  return { reviews, summary };
}
