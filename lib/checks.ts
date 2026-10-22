import { toMinutes, type Order, type Records, type ServiceWindow } from "./records";
import { describeDay } from "./settings";
import { isLowDetail } from "./patterns";
import type { Similar } from "./similarity";
import type { AiReading, Check, CheckKind, Claim, Factor, Review, Verdict } from "./types";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WINDOW_MINUTES = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function ymd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function pretty(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

/** The visit came before the review, so a weekday means its most recent occurrence. */
export function resolveDate(claim: Claim, reviewDate: Date): string | null {
  if (claim.date && /^\d{4}-\d{2}-\d{2}$/.test(claim.date)) return claim.date;
  if (!claim.weekday) return null;
  const idx = WEEKDAYS.indexOf(claim.weekday);
  if (idx === -1) return null;
  const d = new Date(reviewDate.getFullYear(), reviewDate.getMonth(), reviewDate.getDate());
  d.setDate(d.getDate() - ((d.getDay() - idx + 7) % 7));
  return ymd(d);
}

/** The service window that covers this time of day, if any. */
function windowAt(windows: ServiceWindow[], time: number): ServiceWindow | undefined {
  return windows.find((w) => time >= toMinutes(w.open)! && time <= toMinutes(w.close)!);
}

/** Things the records alone rule out: closed days, hours with no service, tables bigger than any we have. */
function impossibleReason(claim: Claim, date: string | null, records: Records): { reason: string; kind: CheckKind } | null {
  const { hours } = records;
  // Opinions and waiting times say nothing about when or how many, whatever the AI copied onto them.
  if (claim.type === "wait_time" || claim.type === "other") return null;
  const aboutPartySize = claim.type === "party_size" || claim.type === "reservation" || claim.type === "bill";
  if (aboutPartySize && claim.party_size !== null && claim.party_size > hours.maxPartySize) {
    return {
      reason: `Largest table seats ${hours.maxPartySize}; a party of ${claim.party_size} exceeds capacity.`,
      kind: "impossible_capacity",
    };
  }
  if (!date) return null;
  const dayName = WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
  const windows = hours.days[dayName] ?? [];
  if (windows.length === 0) {
    return { reason: `${pretty(date)}: the restaurant is closed on ${cap(dayName)}s.`, kind: "impossible_closed" };
  }
  const time = toMinutes(claim.time);
  if (time !== null && !windowAt(windows, time)) {
    const noLunch = !windows.some((w) => w.name === "Lunch") && time >= 11 * 60 && time <= 16 * 60 ? ", no lunch service" : "";
    return {
      reason: `${pretty(date)}: open ${describeDay(windows)}${noLunch}, so ${claim.time} is outside service hours.`,
      kind: "impossible_hours",
    };
  }
  return null;
}

function nearOrders(orders: Order[], date: string, time: number | null, party: number | null): Order[] {
  return orders.filter(
    (o) =>
      o.date === date &&
      (time === null || Math.abs(o.minutes - time) <= WINDOW_MINUTES) &&
      (party === null || o.partySize === party),
  );
}

function describeVisit(date: string, claim: Claim): string {
  const when = claim.time ? ` around ${claim.time}` : "";
  const who = claim.party_size !== null ? ` for ${claim.party_size}` : "";
  return `${pretty(date)}${when}${who}`;
}

/** Singular-ise so "appetizers" finds "(appetizer)" and "steaks" finds "steak". */
function itemMatches(orderItems: string, wanted: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  const words = norm(wanted).split(" ").filter(Boolean).map((w) => w.replace(/(es|s)$/, ""));
  const haystack = norm(orderItems);
  return words.length > 0 && words.every((w) => haystack.includes(w));
}

/** Look one claim up in the records. One row per claim. */
export function checkClaim(claim: Claim, reviewDate: Date, records: Records): Check {
  const row = (status: Check["status"], record: string, kind?: CheckKind): Check => ({ claim: claim.text, record, status, kind });
  const date = resolveDate(claim, reviewDate);

  const impossible = impossibleReason(claim, date, records);
  if (impossible) return row("mismatch", impossible.reason, impossible.kind);

  if (claim.type === "wait_time" || claim.type === "other") {
    return row("no_record", "Waiting times and opinions aren't recorded.");
  }
  if (!date) return row("no_record", "Couldn't tell which day this refers to.");

  const dayOrders = records.orders.filter((o) => o.date === date);
  const dayRes = records.reservations.filter((r) => r.date === date);
  const time = toMinutes(claim.time);

  switch (claim.type) {
    case "date_time": {
      if (time === null) return row("no_record", `${pretty(date)}: no time given to check.`);
      const windows = records.hours.days[WEEKDAYS[new Date(`${date}T00:00:00`).getDay()]] ?? [];
      const w = windowAt(windows, time);
      return row(
        "match",
        `${pretty(date)}: ${claim.time} is within opening hours${w ? ` (${w.name} ${w.open}–${w.close})` : ""}.`,
        "hours_ok",
      );
    }
    case "reservation": {
      if (dayRes.length === 0) return row("no_record", `No reservations on file for ${pretty(date)}.`);
      const found = dayRes.some(
        (r) =>
          (time === null || Math.abs(r.minutes - time) <= 60) &&
          (claim.party_size === null || r.partySize === claim.party_size),
      );
      return found
        ? row("match", `Reservation found: ${describeVisit(date, claim)}.`, "reservation_found")
        : row("mismatch", `No reservation found for ${describeVisit(date, claim)}.`, "no_reservation");
    }
    case "party_size":
    case "bill": {
      if (dayOrders.length === 0) return row("no_record", `No orders on file for ${pretty(date)}.`);
      if (claim.type === "party_size" && claim.party_size === null) {
        return row("no_record", `${pretty(date)}: no party size to check.`);
      }
      const found = nearOrders(records.orders, date, time, claim.party_size);
      if (found.length > 0) {
        const kind = claim.type === "bill" ? "Bill found" : "Order found";
        return row("match", `${kind}: ${describeVisit(date, claim)}.`, "order_found");
      }
      const what = claim.type === "bill" ? "bill" : "order";
      return row("mismatch", `No ${what} found for ${describeVisit(date, claim)}.`, "no_bill");
    }
    case "item_ordered": {
      if (!claim.item) return row("no_record", "No dish named to check.");
      if (dayOrders.length === 0) return row("no_record", `No orders on file for ${pretty(date)}.`);
      const visit = nearOrders(records.orders, date, time, claim.party_size);
      if (visit.length === 0) {
        return row("no_record", `${pretty(date)}: couldn't pin down the visit to check the dish.`);
      }
      return visit.some((o) => itemMatches(o.items, claim.item!))
        ? row("match", `${pretty(date)}: "${claim.item}" is on the matching order.`, "dish_found")
        : row("mismatch", `${pretty(date)}: "${claim.item}" is not on the matching order.`, "no_dish");
    }
  }
}

/**
 * A review usually describes one visit ("table of 10 on Friday at 8 PM"), but the AI may put the
 * day, time and party size on only one claim. Fill the gaps from the visit described elsewhere.
 */
function withVisitContext(claims: Claim[]): Claim[] {
  const first = <K extends "weekday" | "date" | "time" | "party_size">(key: K) =>
    claims.find((c) => c.type !== "wait_time" && c.type !== "other" && c[key] !== null)?.[key] ?? null;
  const ctx = { weekday: first("weekday"), date: first("date"), time: first("time"), party_size: first("party_size") };
  return claims.map((c) => {
    if (c.type === "wait_time" || c.type === "other") return c;
    const needsParty = c.type === "item_ordered" || c.type === "bill" || c.type === "reservation";
    return {
      ...c,
      weekday: c.weekday ?? (c.date ? null : ctx.weekday),
      date: c.date ?? (c.weekday ? null : ctx.date),
      time: c.time ?? ctx.time,
      party_size: c.party_size ?? (needsParty ? ctx.party_size : null),
    };
  });
}

export function buildChecks(claims: Claim[], reviewDate: Date, records: Records): Check[] {
  return withVisitContext(claims).map((c) => checkClaim(c, reviewDate, records));
}

/** True when this one-star review sits in a 24-hour window holding 3 or more one-star reviews. */
export function isBurst(review: Review, all: Review[]): boolean {
  if (review.rating !== 1) return false;
  const times = all
    .filter((r) => r.rating === 1 && !(r.date === review.date && r.text === review.text))
    .map((r) => new Date(r.date).getTime());
  const mine = new Date(review.date).getTime();
  times.push(mine);
  return times.some((start) => {
    const inWindow = times.filter((t) => t >= start && t < start + DAY_MS);
    return inWindow.length >= 3 && mine >= start && mine < start + DAY_MS;
  });
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

const SUSPICION_LINE = 40; // from this score up, a review is called Suspicious

/** Weights for each kind of evidence. Positive adds suspicion, negative adds trust. */
const RISK_POINTS: Partial<Record<CheckKind, { points: number; label: string }>> = {
  impossible_capacity: { points: 40, label: "Party size is bigger than your largest table" },
  impossible_closed: { points: 40, label: "Visit claimed on a day you are closed" },
  impossible_hours: { points: 40, label: "Visit claimed outside your service hours" },
  no_bill: { points: 25, label: "No matching bill found" },
  no_reservation: { points: 25, label: "No matching reservation found" },
  no_dish: { points: 15, label: "A dish named is not on the matching bill" },
};
const TRUST_POINTS: Partial<Record<CheckKind, { points: number; label: string }>> = {
  order_found: { points: -20, label: "A matching bill was found for the party size and time" },
  reservation_found: { points: -15, label: "A matching reservation was found" },
  dish_found: { points: -10, label: "A dish named is on the matching bill" },
};
const MAX_TRUST = -35;

export interface Signals {
  ai: Pick<AiReading, "verdict" | "confidence" | "summary">;
  checks: Check[];
  burst: boolean;
  text: string;
  similar?: Similar | null;
}

const IMPOSSIBLE: CheckKind[] = ["impossible_capacity", "impossible_closed", "impossible_hours"];

/** The weighted reasons behind a review's score, and the total (0-100). */
export function scoreReview({ ai, checks, burst, text, similar }: Signals): { score: number; breakdown: Factor[] } {
  const breakdown: Factor[] = [];
  const seen = new Set<string>();
  for (const c of checks) {
    const rule = c.kind ? RISK_POINTS[c.kind] : undefined;
    if (rule && !seen.has(c.kind!)) {
      seen.add(c.kind!);
      breakdown.push(rule);
    }
  }
  if (burst) breakdown.push({ label: "Posted during a burst of one-star reviews", points: 15 });
  if (similar) {
    breakdown.push({ label: `Wording is ${Math.round(similar.score * 100)}% like ${similar.author}'s review`, points: 20 });
  }
  if (ai.verdict === "Suspicious") breakdown.push({ label: "The wording itself reads as vague or exaggerated", points: 25 });
  if (isLowDetail(text)) breakdown.push({ label: "Strong feeling but no details to check", points: 10 });

  // Trust only counts when nothing in the review is impossible: an impossible claim can't be offset.
  const impossible = checks.some((c) => c.kind && IMPOSSIBLE.includes(c.kind));
  if (!impossible) {
    let trust = 0;
    for (const c of checks) {
      const rule = c.kind ? TRUST_POINTS[c.kind] : undefined;
      if (rule && trust + rule.points >= MAX_TRUST) {
        trust += rule.points;
        breakdown.push(rule);
      }
    }
  }

  const score = clamp(breakdown.reduce((sum, f) => sum + f.points, 0));
  return { score, breakdown };
}

/** Settle the final verdict in plain code from the score. "No record" never makes a review look fake. */
export function settleVerdict(signals: Signals): {
  verdict: Verdict;
  confidence: number;
  summary: string;
  score: number;
  breakdown: Factor[];
} {
  const { ai, checks } = signals;
  const { score, breakdown } = scoreReview(signals);
  const matches = checks.filter((c) => c.status === "match");
  const strong = matches.filter((c) => c.kind && c.kind !== "hours_ok").length;
  const risks = breakdown.filter((f) => f.points > 0).sort((a, b) => b.points - a.points);
  const impossible = checks.find((c) => c.kind && IMPOSSIBLE.includes(c.kind));

  if (score >= SUSPICION_LINE) {
    const summary = impossible
      ? `A claim in this review doesn't fit your records: ${impossible.record}`
      : `Several signals add up: ${risks.slice(0, 2).map((f) => f.label.charAt(0).toLowerCase() + f.label.slice(1)).join("; ")}.`;
    return { verdict: "Suspicious", confidence: clamp(50 + score / 2, 55, 97), summary, score, breakdown };
  }
  if (matches.length >= 2 && strong >= 1 && score < 20) {
    return {
      verdict: "Verified",
      confidence: clamp(60 + 10 * matches.length - score, 70, 97),
      summary: `${matches.length} claims in this review match your records.`,
      score,
      breakdown,
    };
  }
  if (matches.length >= 1) {
    return {
      verdict: "Plausible",
      confidence: clamp(50 + 8 * matches.length - score / 2, 45, 85),
      summary:
        risks.length > 0
          ? `The claims that can be checked mostly fit your records, but note: ${risks[0].label.charAt(0).toLowerCase()}${risks[0].label.slice(1)}.`
          : "The claims that can be checked match your records; the rest can't be verified from them.",
      score,
      breakdown,
    };
  }
  return {
    verdict: "Unverifiable",
    confidence: clamp(60 - score / 2, 35, 60),
    summary:
      risks.length > 0
        ? `Not enough to call it suspicious, but ${risks[0].label.charAt(0).toLowerCase()}${risks[0].label.slice(1)}.`
        : ai.summary || "Nothing in this review can be checked against your records.",
    score,
    breakdown,
  };
}
