import type { Check, CheckKind, CheckResult, ClaimType, EvidenceSource, Factor, FactorGroup, FactorIcon } from "./types";

export type Risk = "low" | "medium" | "high";

export const RISK_LABEL: Record<Risk, string> = { low: "Low risk", medium: "Medium risk", high: "High risk" };

const HIGH_LINE = 40;
const MEDIUM_LINE = 15;

/** A confirmed mismatch: the records directly conflict with what the review says. */
const isConflict = (c: Check) => c.status === "mismatch";

/**
 * The headline. High needs a confirmed conflict with the records and a score of 40 or more, so a review
 * with no conflicts can never be High, whatever else it says. Medium is a score of 15 to 39. Opinions and
 * missing data alone never raise the level. Older saved results fall back to their verdict.
 */
export function riskLevel(result: CheckResult): Risk {
  const conflicts = result.checks.some(isConflict);
  if (typeof result.score !== "number") {
    if (result.verdict === "Suspicious" && conflicts) return "high";
    return result.verdict === "Suspicious" || result.verdict === "Unverifiable" ? "medium" : "low";
  }
  if (result.score >= HIGH_LINE && conflicts) return "high";
  // A review we simply can't check (an opinion, or a day with no records) is not a reason for suspicion.
  return result.score >= MEDIUM_LINE ? "medium" : "low";
}

// ---------------------------------------------------------------------------------------------
// Claim rows: one row per claim in the review, with the evidence for it from each source.
// ---------------------------------------------------------------------------------------------

export type RowStatus = "mismatch" | "match" | "unverified";

export interface ClaimLine {
  source: EvidenceSource | null;
  text: string;
  status: Check["status"];
  kind?: CheckKind;
}

export interface ClaimRow {
  id: string;
  claim: string;
  status: RowStatus;
  lines: ClaimLine[];
  type?: ClaimType;
  /** For ordering: the most serious conflict in the row. */
  weight: number;
}

const SOURCE_BY_KIND: Partial<Record<CheckKind, EvidenceSource>> = {
  impossible_capacity: "Restaurant settings",
  impossible_closed: "Opening hours",
  impossible_hours: "Opening hours",
  hours_ok: "Opening hours",
  order_found: "POS bills",
  no_bill: "POS bills",
  dish_found: "POS bills",
  no_dish: "POS bills",
  reservation_found: "Reservations",
  no_reservation: "Reservations",
  no_free_tables: "Footfall",
};

const WEIGHT: Partial<Record<CheckKind, number>> = {
  impossible_capacity: 40,
  impossible_closed: 40,
  impossible_hours: 40,
  no_bill: 25,
  no_reservation: 25,
  no_free_tables: 20,
  no_dish: 15,
};

export function claimRows(result: CheckResult): ClaimRow[] {
  const byId = new Map<string, ClaimRow>();
  result.checks.forEach((c) => {
    const id = c.cid ?? `t:${c.claim}`; // older results have no claim ids: group by the claim's words
    let row = byId.get(id);
    if (!row) {
      row = { id, claim: c.claim, status: "unverified", lines: [], weight: 0, type: c.ctype };
      byId.set(id, row);
    }
    row.lines.push({ source: c.source ?? (c.kind ? (SOURCE_BY_KIND[c.kind] ?? null) : null), text: c.record, status: c.status, kind: c.kind });
    if (isConflict(c)) row.weight = Math.max(row.weight, (c.kind && WEIGHT[c.kind]) || 10);
  });
  const rows = [...byId.values()];
  for (const row of rows) {
    row.status = row.lines.some((l) => l.status === "mismatch") ? "mismatch" : row.lines.some((l) => l.status === "match") ? "match" : "unverified";
    // Conflicts first within a row, then matches, then what can't be verified.
    const order = { mismatch: 0, match: 1, no_record: 2 } as const;
    row.lines.sort((a, b) => order[a.status] - order[b.status]);
  }
  return rows;
}

export interface ClaimGroups {
  mismatch: ClaimRow[];
  match: ClaimRow[];
  unverified: ClaimRow[];
}

export function groupClaims(result: CheckResult): ClaimGroups {
  const rows = claimRows(result);
  return {
    mismatch: rows.filter((r) => r.status === "mismatch").sort((a, b) => b.weight - a.weight),
    match: rows.filter((r) => r.status === "match"),
    unverified: rows.filter((r) => r.status === "unverified"),
  };
}

// ---------------------------------------------------------------------------------------------
// The plain-English explanation. Only confirmed conflicts are given as reasons for suspicion.
// ---------------------------------------------------------------------------------------------

const join = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
const upper = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const CONFLICT_PHRASE: Partial<Record<CheckKind, string>> = {
  impossible_capacity: "the party size is larger than any table you have",
  impossible_closed: "the restaurant was closed that day",
  impossible_hours: "the restaurant was closed at the time mentioned",
  no_bill: "no bill on file matches the party described",
  no_reservation: "no reservation on file matches",
  no_free_tables: "your tables were already full at that time",
  no_dish: "a dish named isn't on the matching bill",
};

/** 2-3 sentences for the owner. Honest: a missing record is "can't be checked", never a reason for suspicion. */
export function explain(result: CheckResult): string {
  const rows = claimRows(result);
  const conflictRows = rows.filter((r) => r.status === "mismatch");
  const sentences: string[] = [];

  if (conflictRows.length === 0) {
    sentences.push(rows.length === 0 ? "This review makes no claims that can be checked against your records." : "No claim in this review conflicts with your records.");
  } else {
    const reasons: string[] = [];
    for (const row of conflictRows) {
      for (const l of row.lines) {
        const phrase = l.status === "mismatch" && l.kind ? CONFLICT_PHRASE[l.kind] : undefined;
        if (phrase && !reasons.includes(phrase)) reasons.push(phrase);
      }
    }
    const n = conflictRows.length;
    sentences.push(
      `${n === 1 ? "One claim conflicts" : `${n} claims conflict`} with your records${reasons.length ? `: ${join(reasons)}` : ""}.`,
    );
  }

  // What does fit.
  const good: string[] = [];
  const kinds = new Set(rows.flatMap((r) => r.lines.filter((l) => l.status === "match").map((l) => l.kind)));
  const billId = /Bill (\S+)/.exec(rows.flatMap((r) => r.lines).find((l) => l.kind === "order_found")?.text ?? "")?.[1];
  if (kinds.has("order_found")) good.push(`a bill${billId ? ` (${billId})` : ""} matches the party described`);
  if (kinds.has("reservation_found")) good.push("a reservation matches");
  if (kinds.has("hours_ok")) good.push("the day and time fit your opening hours");
  if (kinds.has("dish_found")) good.push("the dish is on the bill");
  if (good.length) sentences.push(`${conflictRows.length ? "Other details do fit" : upper(join(good))}${conflictRows.length ? `: ${join(good)}` : ""}.`);

  // What can't be checked.
  const open: string[] = [];
  const unverified = rows.filter((r) => r.status === "unverified");
  const typed = (t: ClaimType) => unverified.some((r) => r.type === t);
  if (typed("staff")) open.push("the complaint about the staff");
  if (typed("wait_time")) open.push("the wait time");
  if (typed("food_quality")) open.push("the comment about the food");
  if (typed("other")) open.push("the general comments");
  if (unverified.some((r) => r.lines.some((l) => l.kind === "no_data"))) open.push("the details for a day with no bills or reservations on file");
  const known = new Set(open).size;
  if (known === 0 && unverified.length > 0) open.push(unverified.length === 1 ? "one claim" : `${unverified.length} claims`);
  if (open.length) sentences.push(`${upper(join(open))} can't be checked from your records.`);

  return sentences.slice(0, 3).join(" ");
}

// ---------------------------------------------------------------------------------------------
// The score toggle: every point added, grouped, each tied to the claim it came from.
// ---------------------------------------------------------------------------------------------

const CONFLICT_ICONS: FactorIcon[] = ["capacity", "closed", "hours", "bill", "reservation", "dish", "tables"];

function groupOf(f: Factor): FactorGroup {
  if (f.group) return f.group;
  if (f.points < 0) return "trust";
  return f.icon && CONFLICT_ICONS.includes(f.icon) ? "mismatch" : "signal"; // older results
}

export function groupedFactors(result: CheckResult): Record<FactorGroup, Factor[]> | null {
  if (!result.breakdown) return null;
  const out: Record<FactorGroup, Factor[]> = { mismatch: [], missing: [], signal: [], trust: [] };
  for (const f of result.breakdown) out[groupOf(f)].push(f);
  out.mismatch.sort((a, b) => b.points - a.points);
  return out;
}

/** Reasons, biggest impact first. Points that add trust come after the ones that add suspicion. */
export function sortedFactors(factors: Factor[]): Factor[] {
  return [...factors].sort((a, b) => b.points - a.points);
}

// ---------------------------------------------------------------------------------------------
// Underlining the checked claims inside the review text.
// ---------------------------------------------------------------------------------------------

export interface Segment {
  text: string;
  status: RowStatus | null;
  title?: string;
}

/** Cuts the review text into pieces so each claim can be underlined where it appears. */
export function claimSegments(text: string, result: CheckResult): Segment[] {
  const lowerText = text.toLowerCase();
  const spans: { start: number; end: number; row: ClaimRow }[] = [];
  for (const row of claimRows(result)) {
    const needle = row.claim.trim().toLowerCase().replace(/[.!?]+$/, "");
    if (needle.length < 3) continue;
    const start = lowerText.indexOf(needle);
    if (start !== -1) spans.push({ start, end: start + needle.length, row });
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const segments: Segment[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.start < at) continue; // overlaps one already marked
    if (s.start > at) segments.push({ text: text.slice(at, s.start), status: null });
    segments.push({ text: text.slice(s.start, s.end), status: s.row.status, title: s.row.lines[0]?.text });
    at = s.end;
  }
  if (at < text.length) segments.push({ text: text.slice(at), status: null });
  return segments.length ? segments : [{ text, status: null }];
}
