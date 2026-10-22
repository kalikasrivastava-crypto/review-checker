import { toMinutes, type Order, type Records, type ServiceWindow } from "./records";
import { describeDay } from "./settings";
import { isLowDetail } from "./patterns";
import type { Similar } from "./similarity";
import type { Check, CheckKind, Claim, EvidenceSource, Factor, FactorIcon, Review, Verdict, Visit } from "./types";

/**
 * Everything here runs in plain code. The AI only supplies the claims; every comparison with the
 * restaurant's records happens in this file, and the records never leave the server.
 */

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WINDOW_MINUTES = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

function ymd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function pretty(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Claims about how something felt or how long it took. Bills and opening hours can't confirm or deny these. */
const SUBJECTIVE = new Set<Claim["type"]>(["wait_time", "staff", "food_quality", "other"]);

const SUBJECTIVE_TEXT: Record<string, string> = {
  wait_time: "Waiting times aren't recorded, so this can't be checked.",
  staff: "How staff behaved isn't recorded, so this can't be checked.",
  food_quality: "How the food tasted isn't recorded, so this can't be checked.",
  other: "Your records can't confirm or deny this.",
};

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

function nearOrders(orders: Order[], date: string, time: number | null, party: number | null): Order[] {
  return orders.filter(
    (o) =>
      o.date === date &&
      (time === null || Math.abs(o.minutes - time) <= WINDOW_MINUTES) &&
      (party === null || o.partySize === party),
  );
}

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

const tablesFor = (party: number, seatsPerTable: number) => Math.ceil(party / Math.max(1, seatsPerTable));

/**
 * The AI sometimes mislabels an opinion as a checkable claim ("disappointing for the price" as a bill).
 * Only a claim that actually mentions paying, a bill or a booking is treated as one.
 */
function sanitizeClaim(c: Claim): Claim {
  if (c.type === "bill" && !/\b(paid|pay|paying|bill|billed|charged|receipt|invoice|card|cash|tip|tipped)\b|[₹$£€]|\d/i.test(c.text)) return { ...c, type: "other" };
  if (c.type === "reservation" && !/\b(book|booked|booking|reserve|reserved|reservation)\b/i.test(c.text)) return { ...c, type: "other" };
  if (c.type === "item_ordered" && !c.item) return { ...c, type: "other" };
  return c;
}

/**
 * A review usually describes one visit ("table of 10 on Friday at 8 PM"), but the AI may put the
 * day, time and party size on only one claim. Fill the gaps from the visit described elsewhere.
 */
function withVisitContext(rawClaims: Claim[]): Claim[] {
  const claims = rawClaims.map(sanitizeClaim);
  const first = <K extends "weekday" | "date" | "time" | "party_size">(key: K) =>
    claims.find((c) => !SUBJECTIVE.has(c.type) && c[key] !== null)?.[key] ?? null;
  const ctx = { weekday: first("weekday"), date: first("date"), time: first("time"), party_size: first("party_size") };
  return claims.map((c) => {
    if (SUBJECTIVE.has(c.type)) return c;
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

/**
 * All the evidence for one claim, one entry per source. A claim can be contradicted by one source
 * and supported by another (too big a party, but at an hour you were open), so it can have several.
 */
function evidenceFor(claim: Claim, cid: string, reviewDate: Date, records: Records): Check[] {
  const out: Check[] = [];
  const add = (status: Check["status"], record: string, kind: CheckKind, source?: EvidenceSource) =>
    out.push({ cid, claim: claim.text, record, status, kind, source, ctype: claim.type });

  if (SUBJECTIVE.has(claim.type)) {
    add("no_record", SUBJECTIVE_TEXT[claim.type], "subjective");
    return out;
  }

  const { hours } = records;
  const date = resolveDate(claim, reviewDate);
  const time = toMinutes(claim.time);
  const partyClaim = claim.type === "party_size" || claim.type === "reservation" || claim.type === "bill";
  let closedOrOutside = false;

  // Restaurant settings: is the party bigger than any table you have?
  if (partyClaim && claim.party_size !== null && claim.party_size > hours.maxPartySize) {
    add(
      "mismatch",
      `Your largest table seats ${hours.maxPartySize}; a party of ${claim.party_size} is more than that.`,
      "impossible_capacity",
      "Restaurant settings",
    );
  }

  // Opening hours: were you open then?
  if (date) {
    const dayName = WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
    const windows = hours.days[dayName] ?? [];
    if (windows.length === 0) {
      closedOrOutside = true;
      add("mismatch", `${pretty(date)}: the restaurant is closed on ${cap(dayName)}s.`, "impossible_closed", "Opening hours");
    } else if (time !== null) {
      const w = windowAt(windows, time);
      if (!w) {
        closedOrOutside = true;
        const noLunch = !windows.some((x) => x.name === "Lunch") && time >= 11 * 60 && time <= 16 * 60 ? ", no lunch service" : "";
        add(
          "mismatch",
          `${pretty(date)}: open ${describeDay(windows)}${noLunch}, so ${claim.time} is outside service hours.`,
          "impossible_hours",
          "Opening hours",
        );
      } else {
        add("match", `Open ${pretty(date)}, ${w.name} ${w.open}–${w.close}. The claimed time (${claim.time}) fits.`, "hours_ok", "Opening hours");
      }
    }
  }

  // Bills and reservations: is the visit on file?
  const bills = claim.type === "party_size" || claim.type === "bill" || claim.type === "item_ordered";
  if (!closedOrOutside && date) {
    const dayOrders = records.orders.filter((o) => o.date === date);
    const dayRes = records.reservations.filter((r) => r.date === date);

    if (claim.type === "reservation") {
      if (dayRes.length === 0) {
        add("no_record", `No reservations on file for ${pretty(date)}, so this can't be confirmed either way.`, "no_data", "Reservations");
      } else {
        const fits = dayRes.filter(
          (r) => (time === null || Math.abs(r.minutes - time) <= 60) && (claim.party_size === null || r.partySize === claim.party_size),
        );
        if (fits.length > 0) {
          const r = closest(fits, time);
          add(
            "match",
            `Reservation${r.ref ? ` ${r.ref}` : ""} · ${pretty(date)} at ${hhmm(r.minutes)} · party of ${r.partySize}.`,
            "reservation_found",
            "Reservations",
          );
        } else {
          add("mismatch", `No reservation found for ${describeVisit(date, claim)}.`, "no_reservation", "Reservations");
        }
      }
    } else if (bills && claim.type !== "item_ordered") {
      if (claim.party_size === null && claim.type === "party_size") {
        add("no_record", `${pretty(date)}: no party size given, so there is nothing to compare with the bills.`, "vague", "POS bills");
      } else if (dayOrders.length === 0) {
        add("no_record", `No bills on file for ${pretty(date)}, so this can't be confirmed either way.`, "no_data", "POS bills");
      } else {
        const found = nearOrders(records.orders, date, time, claim.party_size);
        if (found.length > 0) {
          const o = closest(found, time);
          add(
            "match",
            `Bill${o.billId ? ` ${o.billId}` : ""} · ${pretty(date)} at ${hhmm(o.minutes)} · party of ${o.partySize}.`,
            "order_found",
            "POS bills",
          );
        } else {
          add("mismatch", `No bill found for ${describeVisit(date, claim)}.`, "no_bill", "POS bills");
        }
      }
    } else if (claim.type === "item_ordered") {
      if (!claim.item) {
        add("no_record", "No dish was named, so there is nothing to look for on the bills.", "vague", "POS bills");
      } else if (dayOrders.length === 0) {
        add("no_record", `No bills on file for ${pretty(date)}, so this can't be confirmed either way.`, "no_data", "POS bills");
      } else {
        const visit = nearOrders(records.orders, date, time, claim.party_size);
        if (visit.length === 0) {
          add("no_record", `${pretty(date)}: couldn't pin down which bill this was, so the dish can't be checked.`, "vague", "POS bills");
        } else {
          const withDish = visit.find((o) => itemMatches(o.items, claim.item!));
          if (withDish) {
            add("match", `"${claim.item}" is on bill${withDish.billId ? ` ${withDish.billId}` : ""} (${pretty(date)}).`, "dish_found", "POS bills");
          } else {
            add(
              "mismatch",
              `"${claim.item}" is not on the matching bill${visit[0]?.billId ? ` (${visit[0].billId})` : ""}.`,
              "no_dish",
              "POS bills",
            );
          }
        }
      }
    }

    // Footfall: if the party isn't on the bills, were there even enough free tables?
    const missedBill = out.some((c) => c.kind === "no_bill" || c.kind === "no_reservation");
    if (missedBill && claim.party_size !== null && time !== null && dayOrders.length > 0) {
      const { tables, seatsPerTable, mealMinutes } = hours;
      const inUse = dayOrders
        .filter((o) => o.minutes <= time && time < o.minutes + mealMinutes)
        .reduce((sum, o) => sum + tablesFor(o.partySize, seatsPerTable), 0);
      const free = Math.max(0, tables - inUse);
      const need = tablesFor(claim.party_size, seatsPerTable);
      if (need > free) {
        add(
          "mismatch",
          `${pretty(date)} around ${claim.time}: ${Math.min(inUse, tables)} of ${tables} tables were in use, leaving ${free}. A party of ${claim.party_size} needs ${need}.`,
          "no_free_tables",
          "Footfall",
        );
      }
    }
  }

  // Nothing at all could be checked: say so plainly instead of leaving the claim without a row.
  if (out.length === 0) {
    const reason = !date
      ? "No day was given, so there is nothing to check against your records."
      : claim.type === "date_time"
        ? `${pretty(date)}: no time was given, so the opening hours can't be checked.`
        : "Not enough detail to check this against your records.";
    add("no_record", reason, "vague");
  }
  return out;
}

export function buildChecks(claims: Claim[], reviewDate: Date, records: Records): Check[] {
  return withVisitContext(claims).flatMap((c, i) => evidenceFor(c, `c${i}`, reviewDate, records));
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

// ---------------------------------------------------------------------------------------------
// Scoring. Confirmed conflicts with the records drive the score. Missing data adds very little.
// Opinions with no data add nothing. Without a confirmed conflict a review can never reach High.
// ---------------------------------------------------------------------------------------------

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

export const HIGH_LINE = 40; // from this score up a review is High risk, and only a confirmed conflict can get there
const NO_CONFLICT_CEILING = HIGH_LINE - 1;

const CONFLICT_POINTS: Partial<Record<CheckKind, { points: number; label: string; icon: FactorIcon }>> = {
  impossible_capacity: { points: 40, label: "Party size is bigger than your largest table", icon: "capacity" },
  impossible_closed: { points: 40, label: "Visit claimed on a day you are closed", icon: "closed" },
  impossible_hours: { points: 40, label: "Visit claimed outside your service hours", icon: "hours" },
  no_bill: { points: 25, label: "No matching bill on file", icon: "bill" },
  no_reservation: { points: 25, label: "No matching reservation on file", icon: "reservation" },
  no_free_tables: { points: 20, label: "Not enough free tables at that time for that party", icon: "tables" },
  no_dish: { points: 15, label: "A dish named is not on the matching bill", icon: "dish" },
};
const TRUST_POINTS: Partial<Record<CheckKind, { points: number; label: string; icon: FactorIcon }>> = {
  order_found: { points: -20, label: "A matching bill was found for the party size and time", icon: "trust" },
  reservation_found: { points: -15, label: "A matching reservation was found", icon: "trust" },
  dish_found: { points: -10, label: "A dish named is on the matching bill", icon: "trust" },
};
const MAX_TRUST = -35;
const MISSING_DATA_POINTS = 3; // per claim that couldn't be checked because there was no data for that day
const MAX_MISSING_POINTS = 6;
const MAX_SIGNAL_POINTS = 20;

export interface Signals {
  checks: Check[];
  burst: boolean;
  text: string;
  similar?: Similar | null;
}

export const isConflict = (c: Check) => c.status === "mismatch";

/** The weighted reasons behind a review's score, and the total (0-100). */
export function scoreReview({ checks, burst, text, similar }: Signals): { score: number; breakdown: Factor[] } {
  const breakdown: Factor[] = [];

  // 1. Confirmed conflicts with the records (these drive the score).
  const seen = new Set<string>();
  for (const c of checks) {
    const rule = c.kind ? CONFLICT_POINTS[c.kind] : undefined;
    const key = `${c.cid}:${c.kind}`;
    if (rule && !seen.has(key)) {
      seen.add(key);
      breakdown.push({ ...rule, group: "mismatch", checkId: c.cid });
    }
  }
  const conflicts = breakdown.length;

  // 2. Missing data: very little, and only where there should have been a record.
  let missing = 0;
  for (const c of checks) {
    if (c.kind === "no_data" && missing + MISSING_DATA_POINTS <= MAX_MISSING_POINTS) {
      missing += MISSING_DATA_POINTS;
      breakdown.push({
        label: c.source === "Reservations" ? "No reservation data on file for that day" : "No bill data on file for that day",
        points: MISSING_DATA_POINTS,
        icon: c.source === "Reservations" ? "reservation" : "bill",
        group: "missing",
        checkId: c.cid,
      });
    }
  }

  // 3. Other signals about the review, capped. Never enough to make a review High on their own.
  const signals: Factor[] = [];
  if (burst) signals.push({ label: "Posted during a burst of one-star reviews", points: 10, icon: "burst", group: "signal" });
  if (similar) {
    signals.push({
      label: `Wording is ${Math.round(similar.score * 100)}% like ${similar.author}'s review`,
      points: 10,
      icon: "similar",
      group: "signal",
    });
  }
  if (isLowDetail(text)) signals.push({ label: "Strong feeling but no details to check", points: 5, icon: "detail", group: "signal" });
  let signalTotal = 0;
  for (const f of signals) {
    if (signalTotal + f.points <= MAX_SIGNAL_POINTS) {
      signalTotal += f.points;
      breakdown.push(f);
    }
  }

  // 4. Supporting evidence lowers the score, but never offsets a claim that is impossible.
  const impossible = checks.some((c) => c.kind === "impossible_capacity" || c.kind === "impossible_closed" || c.kind === "impossible_hours");
  if (!impossible) {
    let trust = 0;
    for (const c of checks) {
      const rule = c.kind ? TRUST_POINTS[c.kind] : undefined;
      if (rule && trust + rule.points >= MAX_TRUST) {
        trust += rule.points;
        breakdown.push({ ...rule, group: "trust", checkId: c.cid });
      }
    }
  }

  let score = clamp(breakdown.reduce((sum, f) => sum + f.points, 0));
  if (conflicts === 0) score = Math.min(score, NO_CONFLICT_CEILING);
  return { score, breakdown };
}

/** Settle the final verdict from the score. A missing record never counts as a conflict. */
export function settleVerdict(signals: Signals): {
  verdict: Verdict;
  confidence: number;
  summary: string;
  score: number;
  breakdown: Factor[];
} {
  const { checks } = signals;
  const { score, breakdown } = scoreReview(signals);
  const matches = checks.filter((c) => c.status === "match");
  const strong = matches.filter((c) => c.kind && c.kind !== "hours_ok").length;

  if (score >= HIGH_LINE) {
    return {
      verdict: "Suspicious",
      confidence: clamp(50 + score / 2, 55, 97),
      summary: "Details in this review conflict with your records.",
      score,
      breakdown,
    };
  }
  if (matches.length >= 2 && strong >= 1 && score < 20) {
    return {
      verdict: "Verified",
      confidence: clamp(60 + 10 * matches.length - score, 70, 97),
      summary: `${matches.length} details in this review match your records.`,
      score,
      breakdown,
    };
  }
  if (matches.length >= 1) {
    return {
      verdict: "Plausible",
      confidence: clamp(50 + 8 * matches.length - score / 2, 45, 85),
      summary: "The details that can be checked fit your records.",
      score,
      breakdown,
    };
  }
  return {
    verdict: "Unverifiable",
    confidence: clamp(60 - score / 2, 35, 60),
    summary: "Not enough in this review could be confirmed from your records.",
    score,
    breakdown,
  };
}
