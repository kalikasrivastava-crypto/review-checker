import { buildChecks, isBurst } from "./checks";
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
function roughClaims(text: string): Claim[] {
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

export interface Insights {
  total: number;
  genuine: number;
  themes: { key: ThemeKey; label: string; count: number; reviews: { id: string; author: string; snippet: string }[] }[];
  excluded: Excluded[];
  screens: Record<string, Screen>;
}

export function screenReview(r: Review, records: Records, all: Review[]): Screen {
  if (r.rating > 3) return { flagged: false, reasons: [] };
  const reasons: string[] = [];
  const checks = buildChecks(roughClaims(r.text), new Date(r.date), records);
  const mismatch = checks.find((c) => c.status === "mismatch");
  const strongMatch = checks.some((c) => c.status === "match" && !/opening hours/.test(c.record));
  if (mismatch) reasons.push(`A claim doesn't fit your records: ${mismatch.record}`);
  if (isBurst(r, all) && !strongMatch) {
    reasons.push("One of several one-star reviews in 24 hours, and nothing in it could be confirmed.");
  }
  if (!mismatch && isLowDetail(r.text)) reasons.push("Strong feeling but no details to check (low detail).");
  return { flagged: reasons.length > 0, reasons };
}

/**
 * Group genuine complaints by theme. A review counts as a genuine complaint when it is 3 stars or lower
 * and the code-only screen finds nothing wrong with it. No AI call is needed per review.
 */
export function buildInsights(records: Records, reviews: Review[]): Insights {
  const excluded: Excluded[] = [];
  const genuine: Review[] = [];
  const screens: Record<string, Screen> = {};

  for (const r of reviews) {
    const who = r.author ?? "Reviewer";
    const id = r.id ?? who;
    const screen = screenReview(r, records, reviews);
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

  return { total: reviews.length, genuine: genuine.length, themes, excluded, screens };
}
