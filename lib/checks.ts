import { toMinutes, type Order, type Records, type ServiceWindow } from "./records";
import { describeDay } from "./settings";
import { isLowDetail } from "./patterns";
import type { Similar } from "./similarity";
import type { AiReading, Check, CheckKind, Claim, Factor, FactorIcon, Review, Verdict, Visit } from "./types";

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

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** "a party of 10 on Fri 16 Oct around 20:00" */
function describeVisit(date: string, claim: Claim): string {
  const who = claim.party_size !== null ? `a party of ${claim.party_size} on ` : "";
  const when = claim.time ? ` around ${claim.time}` : "";
  return `${who}${pretty(date)}${when}`;
}

/** The record closest in time to the claimed time. */
function closest<T extends { minutes: number }>(rows: T[], time: number | null): T {
  if (time === null) return rows[0];
  return [...rows].sort((a, b) => Math.abs(a.minutes - time) - Math.abs(b.minutes - time))[0];
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
  const date = resolveDate(claim, reviewDate);
  const impossible = impossibleReason(claim, date, records);
  if (impossible) return { claim: claim.text, record: impossible.reason, status: "mismatch", kind: impossible.kind };
  return lookupClaim(claim, date, records);
}

/** Look the claim up in the bills and reservations (after the "is it even possible" checks). */
function lookupClaim(claim: Claim, date: string | null, records: Records): Check {
  const row = (status: Check["status"], record: string, kind?: CheckKind): Check => ({ claim: claim.text, record, status, kind });

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
        `Open ${pretty(date)}${w ? `, ${w.name} ${w.open}–${w.close}` : ""}. The claimed time (${claim.time}) fits.`,
        "hours_ok",
      );
    }
    case "reservation": {
      if (dayRes.length === 0) return row("no_record", `No reservations on file for ${pretty(date)}.`);
      const fits = dayRes.filter(
        (r) =>
          (time === null || Math.abs(r.minutes - time) <= 60) &&
          (claim.party_size === null || r.partySize === claim.party_size),
      );
      if (fits.length > 0) {
        const r = closest(fits, time);
        return row(
          "match",
          `Reservation${r.ref ? ` ${r.ref}` : ""} · ${pretty(date)} at ${hhmm(r.minutes)} · party of ${r.partySize}.`,
          "reservation_found",
        );
      }
      return row("mismatch", `No reservation found for ${describeVisit(date, claim)}.`, "no_reservation");
    }
    case "party_size":
    case "bill": {
      if (dayOrders.length === 0) return row("no_record", `No bills on file for ${pretty(date)}.`);
      if (claim.type === "party_size" && claim.party_size === null) {
        return row("no_record", `${pretty(date)}: no party size to check.`);
      }
      const found = nearOrders(records.orders, date, time, claim.party_size);
      if (found.length > 0) {
        const o = closest(found, time);
        return row(
          "match",
          `Bill${o.billId ? ` ${o.billId}` : ""} · ${pretty(date)} at ${hhmm(o.minutes)} · party of ${o.partySize}.`,
          "order_found",
        );
      }
      return row("mismatch", `No bill found for ${describeVisit(date, claim)}.`, "no_bill");
    }
    case "item_ordered": {
      if (!claim.item) return row("no_record", "No dish named to check.");
      if (dayOrders.length === 0) return row("no_record", `No bills on file for ${pretty(date)}.`);
      const visit = nearOrders(records.orders, date, time, claim.party_size);
      if (visit.length === 0) {
        return row("no_record", `${pretty(date)}: couldn't pin down the visit to check the dish.`);
      }
      const withDish = visit.find((o) => itemMatches(o.items, claim.item!));
      return withDish
        ? row("match", `"${claim.item}" is on bill${withDish.billId ? ` ${withDish.billId}` : ""} (${pretty(date)}).`, "dish_found")
        : row("mismatch", `"${claim.item}" is not on the matching bill${visit[0]?.billId ? ` (${visit[0].billId})` : ""}.`, "no_dish");
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

const tablesFor = (party: number, seatsPerTable: number) => Math.ceil(party / Math.max(1, seatsPerTable));

/**
 * If a claimed party can't be found in the bills or reservations, were there even enough free tables
 * at that time? Tables in use = every bill that started within the usual meal length before then.
 * Needs bills for that day: with none on file we can't say the room was full.
 */
function tableCheck(claim: Claim, reviewDate: Date, row: Check, records: Records): Check | null {
  const partyClaim = claim.type === "party_size" || claim.type === "reservation" || claim.type === "bill";
  if (!partyClaim || claim.party_size === null) return null;
  if (row.kind !== "no_bill" && row.kind !== "no_reservation") return null;
  const date = resolveDate(claim, reviewDate);
  const time = toMinutes(claim.time);
  if (!date || time === null) return null;
  const dayOrders = records.orders.filter((o) => o.date === date);
  if (dayOrders.length === 0) return null;

  const { tables, seatsPerTable, mealMinutes } = records.hours;
  const inUse = dayOrders
    .filter((o) => o.minutes <= time && time < o.minutes + mealMinutes)
    .reduce((sum, o) => sum + tablesFor(o.partySize, seatsPerTable), 0);
  const free = Math.max(0, tables - inUse);
  const need = tablesFor(claim.party_size, seatsPerTable);
  if (need <= free) return null;
  return {
    claim: claim.text,
    status: "mismatch",
    kind: "no_free_tables",
    record: `${pretty(date)} around ${claim.time}: ${Math.min(inUse, tables)} of ${tables} tables were in use, leaving ${free}. A party of ${claim.party_size} needs ${need}.`,
  };
}

/** How busy the restaurant was on the day the review says it visited (needs bills for that day). */
export function visitInfo(claims: Claim[], reviewDate: Date, records: Records): Visit | null {
  let date: string | null = null;
  for (const c of withVisitContext(claims)) {
    date = resolveDate(c, reviewDate);
    if (date) break;
  }
  if (!date) return null;
  const perDay = new Map<string, { bills: number; covers: number }>();
  for (const o of records.orders) {
    const d = perDay.get(o.date) ?? { bills: 0, covers: 0 };
    d.bills++;
    d.covers += o.partySize;
    perDay.set(o.date, d);
  }
  const day = perDay.get(date);
  if (!day) return null;
  const rank = 1 + [...perDay.values()].filter((d) => d.covers > day.covers).length;
  return { date, label: pretty(date), bills: day.bills, covers: day.covers, rank, daysOnFile: perDay.size };
}

export function buildChecks(claims: Claim[], reviewDate: Date, records: Records): Check[] {
  return withVisitContext(claims).flatMap((c) => {
    const row = checkClaim(c, reviewDate, records);
    // A party too big for any table also can't be in the bills. Say so as well: it is separate evidence.
    if (row.kind === "impossible_capacity") {
      const lookup = lookupClaim(c, resolveDate(c, reviewDate), records);
      return lookup.kind === "no_bill" || lookup.kind === "no_reservation" ? [row, lookup] : [row];
    }
    const tables = tableCheck(c, reviewDate, row, records);
    return tables ? [row, tables] : [row];
  });
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
const RISK_POINTS: Partial<Record<CheckKind, { points: number; label: string; icon: FactorIcon }>> = {
  impossible_capacity: { points: 40, label: "Party size is bigger than your largest table", icon: "capacity" },
  impossible_closed: { points: 40, label: "Visit claimed on a day you are closed", icon: "closed" },
  impossible_hours: { points: 40, label: "Visit claimed outside your service hours", icon: "hours" },
  no_bill: { points: 25, label: "No matching bill found", icon: "bill" },
  no_reservation: { points: 25, label: "No matching reservation found", icon: "reservation" },
  no_dish: { points: 15, label: "A dish named is not on the matching bill", icon: "dish" },
  no_free_tables: { points: 20, label: "Not enough free tables at that time for that party", icon: "tables" },
};
const TRUST_POINTS: Partial<Record<CheckKind, { points: number; label: string; icon: FactorIcon }>> = {
  order_found: { points: -20, label: "A matching bill was found for the party size and time", icon: "trust" },
  reservation_found: { points: -15, label: "A matching reservation was found", icon: "trust" },
  dish_found: { points: -10, label: "A dish named is on the matching bill", icon: "trust" },
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
  if (burst) breakdown.push({ label: "Posted during a burst of one-star reviews", points: 15, icon: "burst" });
  if (similar) {
    breakdown.push({
      label: `Wording is ${Math.round(similar.score * 100)}% like ${similar.author}'s review`,
      points: 20,
      icon: "similar",
    });
  }
  if (ai.verdict === "Suspicious") breakdown.push({ label: "The wording itself reads as vague or exaggerated", points: 25, icon: "wording" });
  if (isLowDetail(text)) breakdown.push({ label: "Strong feeling but no details to check", points: 10, icon: "detail" });

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
