import { toMinutes, type Order, type Records, type ServiceWindow } from "./records";
import { describeDay } from "./settings";
import type { AiReading, Check, Claim, Review, Verdict } from "./types";

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
function resolveDate(claim: Claim, reviewDate: Date): string | null {
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
function impossibleReason(claim: Claim, date: string | null, records: Records): string | null {
  const { hours } = records;
  // Opinions and waiting times say nothing about when or how many, whatever the AI copied onto them.
  if (claim.type === "wait_time" || claim.type === "other") return null;
  const aboutPartySize = claim.type === "party_size" || claim.type === "reservation" || claim.type === "bill";
  if (aboutPartySize && claim.party_size !== null && claim.party_size > hours.maxPartySize) {
    return `Largest table seats ${hours.maxPartySize}; a party of ${claim.party_size} exceeds capacity.`;
  }
  if (!date) return null;
  const dayName = WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
  const windows = hours.days[dayName] ?? [];
  if (windows.length === 0) return `${pretty(date)}: the restaurant is closed on ${cap(dayName)}s.`;
  const time = toMinutes(claim.time);
  if (time !== null && !windowAt(windows, time)) {
    const noLunch = !windows.some((w) => w.name === "Lunch") && time >= 11 * 60 && time <= 16 * 60 ? ", no lunch service" : "";
    return `${pretty(date)}: open ${describeDay(windows)}${noLunch}, so ${claim.time} is outside service hours.`;
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
  const row = (status: Check["status"], record: string): Check => ({ claim: claim.text, record, status });
  const date = resolveDate(claim, reviewDate);

  const impossible = impossibleReason(claim, date, records);
  if (impossible) return row("mismatch", impossible);

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
      return row("match", `${pretty(date)}: ${claim.time} is within opening hours${w ? ` (${w.name} ${w.open}–${w.close})` : ""}.`);
    }
    case "reservation": {
      if (dayRes.length === 0) return row("no_record", `No reservations on file for ${pretty(date)}.`);
      const found = dayRes.some(
        (r) =>
          (time === null || Math.abs(r.minutes - time) <= 60) &&
          (claim.party_size === null || r.partySize === claim.party_size),
      );
      return found
        ? row("match", `Reservation found: ${describeVisit(date, claim)}.`)
        : row("mismatch", `No reservation found for ${describeVisit(date, claim)}.`);
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
        return row("match", `${kind}: ${describeVisit(date, claim)}.`);
      }
      const what = claim.type === "bill" ? "bill" : "order";
      return row("mismatch", `No ${what} found for ${describeVisit(date, claim)}.`);
    }
    case "item_ordered": {
      if (!claim.item) return row("no_record", "No dish named to check.");
      if (dayOrders.length === 0) return row("no_record", `No orders on file for ${pretty(date)}.`);
      const visit = nearOrders(records.orders, date, time, claim.party_size);
      if (visit.length === 0) {
        return row("no_record", `${pretty(date)}: couldn't pin down the visit to check the dish.`);
      }
      return visit.some((o) => itemMatches(o.items, claim.item!))
        ? row("match", `${pretty(date)}: "${claim.item}" is on the matching order.`)
        : row("mismatch", `${pretty(date)}: "${claim.item}" is not on the matching order.`);
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

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * Settle the final verdict in plain code. The AI only sees the review text, so:
 * - any mismatch (including an impossible claim) means Suspicious,
 * - "Verified" needs at least two claims that match the records,
 * - no record never makes a review look fake on its own.
 */
export function settleVerdict(
  ai: Pick<AiReading, "verdict" | "confidence" | "summary">,
  checks: Check[],
  burst: boolean,
): { verdict: Verdict; confidence: number; summary: string } {
  const mismatches = checks.filter((c) => c.status === "mismatch");
  const matches = checks.filter((c) => c.status === "match");
  const aiSuspicious = ai.verdict === "Suspicious";

  if (mismatches.length > 0) {
    const first = mismatches[0].record;
    return {
      verdict: "Suspicious",
      confidence: clamp(70 + 10 * Math.min(mismatches.length, 2) + (aiSuspicious ? 5 : 0)),
      summary:
        mismatches.length === 1
          ? `A claim in this review doesn't fit your records: ${first}`
          : `${mismatches.length} claims in this review don't fit your records.`,
    };
  }
  if (matches.length >= 2 && !burst && !aiSuspicious) {
    return {
      verdict: "Verified",
      confidence: clamp(60 + 12 * matches.length),
      summary: `${matches.length} claims in this review match your records.`,
    };
  }
  if (matches.length >= 1) {
    return {
      verdict: "Plausible",
      confidence: clamp(50 + 8 * matches.length),
      summary: burst
        ? "The checkable claims match your records, but this review arrived with a burst of one-star reviews."
        : "The claims that can be checked match your records; the rest can't be verified from them.",
    };
  }
  if (burst || aiSuspicious) {
    return {
      verdict: "Suspicious",
      confidence: clamp(Math.max(ai.confidence, 55)),
      summary: burst
        ? "Three or more one-star reviews arrived within 24 hours and none of the claims could be confirmed."
        : ai.summary,
    };
  }
  return {
    verdict: "Unverifiable",
    confidence: clamp(Math.min(Math.max(ai.confidence, 40), 60)),
    summary: ai.summary || "Nothing in this review can be checked against your records.",
  };
}

