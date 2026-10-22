import { buildChecks, isBurst, resolveDate } from "./checks";
import { mostSimilar, type Similar } from "./similarity";
import { isLowDetail } from "./patterns";
import type { Records } from "./records";
import type { Claim, Review } from "./types";

export type ThemeKey = "wait" | "food" | "service" | "reservations";

const THEMES: { key: ThemeKey; label: string; cue: RegExp }[] = [
  {
    key: "wait",
    label: "Wait time",
    cue: /\b(wait(ed|ing)?|slow|forever|took (ages|long)|long time|an hour|\d+\s?(min|mins|minutes|hours?))\b/i,
  },
  {
    key: "food",
    label: "Food quality",
    cue: /\b(cold|bland|overcooked|undercooked|dry|lukewarm|burnt|burned|stale|raw|greasy|soggy|salty|tasteless|well done|rubbery|inedible)\b/i,
  },
  {
    key: "service",
    label: "Service",
    cue: /\b(rude|rushed|ignored|unfriendly|inattentive|unwelcom\w*|dismissive|impolite|nobody (told|came|took)|no one (told|came))\b/i,
  },
  {
    key: "reservations",
    label: "Reservations",
    cue: /\b(reservation|reserved|booking|booked|lost our table|double.?booked)\b/i,
  },
];

export function detectThemes(text: string): ThemeKey[] {
  return THEMES.filter((t) => t.cue.test(text)).map((t) => t.key);
}

const WEEKDAY = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
const TIME = /\b(\d{1,2})(?::(\d{2}))?\s?(a\.?m\.?|p\.?m\.?)(?![a-z])/i;
const NUMBER_WORDS: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12 };
const PARTY = /\b(?:party|table|group|reservation|booking)\s+(?:of|for)\s+(\d+|two|three|four|five|six|seven|eight|nine|ten|twelve)\b|\b(\d+|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(?:of us|people|guests|diners)\b|\bjust the (two|three|four) of us\b/i;

/** A rough, AI-free read of the claims in a review: weekday, time and party size. */
export function roughClaims(text: string): Claim[] {
  const day = WEEKDAY.exec(text)?.[1]?.toLowerCase() ?? null;
  const t = TIME.exec(text);
  let time: string | null = null;
  if (t) {
    const h = (Number(t[1]) % 12) + (t[3].toLowerCase().startsWith("p") ? 12 : 0);
    time = `${String(h).padStart(2, "0")}:${t[2] ?? "00"}`;
  }
  const p = PARTY.exec(text);
  const raw = p?.[1] ?? p?.[2] ?? p?.[3];
  const party = raw ? (Number.isNaN(Number(raw)) ? (NUMBER_WORDS[raw.toLowerCase()] ?? null) : Number(raw)) : null;
  const base = { text: "", party_size: null, weekday: day, date: null, time, item: null };
  const claims: Claim[] = [];
  if (party !== null) {
    const reservation = /\b(reservation|reserved|booking|booked)\b/i.test(text);
    claims.push({ ...base, text: "party", type: reservation ? "reservation" : "party_size", party_size: party });
  }
  if (day && time) claims.push({ ...base, text: "visit", type: "date_time" });
  return claims;
}

export interface Excluded {
  id: string;
  author: string;
  reason: string;
}

/** A code-only first look at a review: does anything in it already clash with the records? */
export interface Screen {
  flagged: boolean;
  reasons: string[];
}

export interface FootfallDay {
  date: string; // YYYY-MM-DD
  bills: number;
  covers: number; // people seated, from party sizes
  inRecords: boolean; // false when the date is outside the bills you have
  claims: { id: string; author: string; rating: number }[]; // 1-2 star reviews claiming a visit that day
}

export interface Footfall {
  days: FootfallDay[]; // whole weeks, Monday first
  maxCovers: number;
  tables: number;
}

export interface SimilarPair {
  a: { id: string; author: string; snippet: string };
  b: { id: string; author: string; snippet: string };
  score: number;
}

export interface Insights {
  total: number;
  genuine: number;
  themes: { key: ThemeKey; label: string; count: number; reviews: { id: string; author: string; snippet: string }[] }[];
  excluded: Excluded[];
  screens: Record<string, Screen>;
  similarOf: Record<string, Similar>;
  similarPairs: SimilarPair[];
  footfall: Footfall | null;
}

export function screenReview(r: Review, records: Records, all: Review[], similar?: Similar | null): Screen {
  if (r.rating > 3) return { flagged: false, reasons: [] };
  const reasons: string[] = [];
  const checks = buildChecks(roughClaims(r.text), new Date(r.date), records);
  const mismatch = checks.find((c) => c.status === "mismatch");
  const strongMatch = checks.some((c) => c.status === "match" && c.kind !== "hours_ok");
  if (mismatch) reasons.push(`A claim doesn't fit your records: ${mismatch.record}`);
  if (isBurst(r, all) && !strongMatch) {
    reasons.push("One of several one-star reviews in 24 hours, and nothing in it could be confirmed.");
  }
  if (similar && r.rating <= 2) reasons.push(`Reads ${Math.round(similar.score * 100)}% like ${similar.author}'s review.`);
  if (!mismatch && isLowDetail(r.text)) reasons.push("Strong feeling but no details to check (low detail).");
  return { flagged: reasons.length > 0, reasons };
}

/**
 * Group genuine complaints by theme. A review counts as a genuine complaint when it is 3 stars or lower
 * and the code-only screen finds nothing wrong with it. No AI call is needed per review.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Busy-ness per day from the bills, next to the days that 1-2 star reviews say they visited. */
function buildFootfall(records: Records, reviews: Review[]): Footfall | null {
  if (records.orders.length === 0) return null;
  const dates = records.orders.map((o) => o.date).sort();
  const recFrom = dates[0];
  const recTo = dates[dates.length - 1];

  const claimed: Record<string, { id: string; author: string; rating: number }[]> = {};
  for (const r of reviews) {
    if (r.rating > 2) continue;
    const claim = roughClaims(r.text).find((c) => c.weekday || c.date);
    const date = claim ? resolveDate(claim, new Date(r.date)) : null;
    if (!date) continue;
    (claimed[date] ??= []).push({ id: r.id ?? "", author: r.author ?? "Reviewer", rating: r.rating });
  }

  // Show the last three weeks that hold bills or claims, in whole weeks starting on Monday.
  const claimDates = Object.keys(claimed);
  const last = [recTo, ...claimDates].sort().pop() as string;
  const end = new Date(`${last}T00:00:00`);
  end.setDate(end.getDate() + ((7 - end.getDay()) % 7)); // up to Sunday
  const start = new Date(end.getTime() - (3 * 7 - 1) * DAY_MS);

  const days: FootfallDay[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) {
    const date = ymd(new Date(t));
    const dayOrders = records.orders.filter((o) => o.date === date);
    days.push({
      date,
      bills: dayOrders.length,
      covers: dayOrders.reduce((sum, o) => sum + o.partySize, 0),
      inRecords: date >= recFrom && date <= recTo,
      claims: claimed[date] ?? [],
    });
  }
  return { days, maxCovers: Math.max(1, ...days.map((d) => d.covers)), tables: records.hours.tables };
}

/**
 * Group genuine complaints by theme. A review counts as a genuine complaint when it is 3 stars or lower
 * and the code-only screen finds nothing wrong with it. No AI call is needed per review.
 */
export function buildInsights(records: Records, reviews: Review[]): Insights {
  const excluded: Excluded[] = [];
  const genuine: Review[] = [];
  const screens: Record<string, Screen> = {};
  const similarOf: Record<string, Similar> = {};
  const pairs = new Map<string, SimilarPair>();
  const snippet = (t: string) => (t.length > 90 ? `${t.slice(0, 87)}…` : t);

  for (const r of reviews) {
    const who = r.author ?? "Reviewer";
    const id = r.id ?? who;
    const similar = mostSimilar(r, reviews);
    if (similar) {
      similarOf[id] = similar;
      const key = [id, similar.id].sort().join("|");
      const other = reviews.find((x) => x.id === similar.id);
      if (other && !pairs.has(key)) {
        pairs.set(key, {
          a: { id, author: who, snippet: snippet(r.text) },
          b: { id: similar.id, author: other.author ?? "Reviewer", snippet: snippet(other.text) },
          score: similar.score,
        });
      }
    }
    const screen = screenReview(r, records, reviews, similar);
    screens[id] = screen;
    if (r.rating > 3) continue;
    if (screen.flagged) excluded.push({ id, author: who, reason: screen.reasons[0] });
    else genuine.push(r);
  }

  const themes = THEMES.map((t) => {
    const matching = genuine.filter((r) => detectThemes(r.text).includes(t.key));
    return {
      key: t.key,
      label: t.label,
      count: matching.length,
      reviews: matching.map((r) => ({
        id: r.id ?? r.author ?? "",
        author: r.author ?? "Reviewer",
        snippet: r.text.length > 110 ? `${r.text.slice(0, 107)}…` : r.text,
      })),
    };
  }).sort((a, b) => b.count - a.count);

  return {
    total: reviews.length,
    genuine: genuine.length,
    themes,
    excluded,
    screens,
    similarOf,
    similarPairs: [...pairs.values()].sort((x, y) => y.score - x.score),
    footfall: buildFootfall(records, reviews),
  };
}
