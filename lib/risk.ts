import type { Check, CheckKind, CheckResult, Factor, FactorIcon } from "./types";

export type Risk = "low" | "medium" | "high";

export const RISK_LABEL: Record<Risk, string> = { low: "Low risk", medium: "Medium risk", high: "High risk" };

const IMPOSSIBLE: CheckKind[] = ["impossible_capacity", "impossible_closed", "impossible_hours"];
const MISSING_KINDS: CheckKind[] = ["no_bill", "no_reservation", "no_dish"];

/**
 * The headline: high if the score is 40 or more; medium if some signals add up (15+) or there is
 * nothing in the review we could check; low otherwise. Older saved results fall back to their verdict.
 */
export function riskLevel(result: CheckResult): Risk {
  if (typeof result.score !== "number") {
    return result.verdict === "Suspicious" ? "high" : result.verdict === "Unverifiable" ? "medium" : "low";
  }
  if (result.score >= 40) return "high";
  const matches = result.checks.filter((c) => c.status === "match").length;
  if (result.score >= 15 || (result.verdict === "Unverifiable" && matches === 0)) return "medium";
  return "low";
}

const join = (parts: string[]) =>
  parts.length <= 1 ? (parts[0] ?? "") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const quote = (c: Check) => `“${c.claim}”`;

function whenOf(c: Check): string {
  const m = /around (\d{1,2}):\d{2}/.exec(c.record);
  if (!m) return "";
  const h = Number(m[1]);
  return h >= 17 ? " that evening" : h >= 12 ? " that afternoon" : " that day";
}

/** One plain-English sentence for the hero, built from the evidence (not from the AI). */
export function plainSummary(result: CheckResult): string {
  const kinds = result.checks.some((c) => c.kind);
  if (!kinds && !result.breakdown) return result.summary;
  const risk = riskLevel(result);
  const find = (k: CheckKind) => result.checks.find((c) => c.kind === k);
  const factor = (icon: FactorIcon) => result.breakdown?.find((f) => f.icon === icon && f.points > 0);

  let head = "";
  const tails: string[] = [];

  const cap = find("impossible_capacity");
  const closed = find("impossible_closed");
  const hours = find("impossible_hours");
  if (cap) {
    const n = /seats (\d+)/.exec(cap.record)?.[1];
    head = `claims ${quote(cap)}`;
    tails.push(n ? `your largest table seats ${n}` : "that is more than you can seat");
  } else if (closed) {
    head = "claims a visit on a day you were closed";
  } else if (hours) {
    head = "claims a visit at a time you weren't serving";
  }
  const noBill = find("no_bill");
  if (noBill) tails.push(`there's no matching bill${whenOf(noBill)}`);
  if (find("no_reservation")) tails.push("there's no matching reservation");
  if (find("no_free_tables")) tails.push("your tables were already full then");
  if (find("no_dish")) tails.push("the dish isn't on the matching bill");
  if (factor("burst")) tails.push("it was posted during a burst of one-star reviews");
  const similar = factor("similar");
  if (similar) tails.push(`its ${lower(similar.label)}`);
  if (factor("wording")) tails.push("the wording reads as vague or exaggerated");

  if (risk === "high") {
    if (head) return `This review ${head}${tails.length ? `, but ${join(tails)}` : ""}.`;
    return tails.length ? `This review looks suspicious: ${join(tails.slice(0, 3))}.` : result.summary;
  }
  if (risk === "medium") {
    if (tails.length) return `We couldn't confirm this review: ${join(tails.slice(0, 3))}. That isn't proof it's fake.`;
    return "There isn't much in this review that can be checked against your records, so we can't tell either way.";
  }
  const good: string[] = [];
  const bill = find("order_found");
  if (bill) good.push(`a matching bill was found (${/Bill (\S+)/.exec(bill.record)?.[1] ?? "on file"})`);
  if (find("reservation_found")) good.push("a matching reservation was found");
  if (find("hours_ok")) good.push("the day and time fit your opening hours");
  if (find("dish_found")) good.push("the dish is on the bill");
  return good.length
    ? `This looks like a genuine complaint: ${join(good)}.`
    : "Nothing in this review clashes with your records.";
}

export type EvidenceTone = "supports" | "contradicts" | "missing" | "context";
export type EvidenceIcon = "bill" | "reservation" | "hours" | "dish" | "capacity" | "closed" | "tables" | "busy" | "info";

export interface EvidenceItem {
  tone: EvidenceTone;
  icon: EvidenceIcon;
  claim?: string;
  text: string;
}

const ICON_BY_KIND: Partial<Record<CheckKind, EvidenceIcon>> = {
  order_found: "bill",
  reservation_found: "reservation",
  hours_ok: "hours",
  dish_found: "dish",
  impossible_capacity: "capacity",
  impossible_closed: "closed",
  impossible_hours: "hours",
  no_free_tables: "tables",
  no_bill: "bill",
  no_reservation: "reservation",
  no_dish: "dish",
};

/** Splits the checks into "evidence found" (supports or contradicts) and "missing evidence" (couldn't confirm). */
export function groupEvidence(result: CheckResult): { found: EvidenceItem[]; missing: EvidenceItem[] } {
  const found: EvidenceItem[] = [];
  const missing: EvidenceItem[] = [];
  for (const c of result.checks) {
    const icon = (c.kind && ICON_BY_KIND[c.kind]) || "info";
    const item = { icon, claim: c.claim, text: c.record };
    if (c.status === "match") found.push({ tone: "supports", ...item });
    else if (c.kind && IMPOSSIBLE.includes(c.kind)) found.push({ tone: "contradicts", ...item });
    else if (c.kind === "no_free_tables") found.push({ tone: "contradicts", ...item });
    else if (c.kind && MISSING_KINDS.includes(c.kind)) missing.push({ tone: "missing", ...item });
    else if (c.status === "mismatch") found.push({ tone: "contradicts", ...item }); // older results without a kind
    else missing.push({ tone: "missing", ...item });
  }
  const v = result.visit;
  if (v) {
    const how = v.rank === 1 ? "the busiest day on file" : v.rank <= 2 ? "one of the busiest days on file" : "a quieter day";
    found.push({
      tone: "context",
      icon: "busy",
      text: `${v.label} was ${how}: ${v.bills} bill${v.bills === 1 ? "" : "s"}, ${v.covers} guests (${v.daysOnFile} days on file).`,
    });
  }
  return { found, missing };
}

export interface Segment {
  text: string;
  status: Check["status"] | null;
  title?: string;
}

const RANK: Record<Check["status"], number> = { mismatch: 3, match: 2, no_record: 1 };

/** Cuts the review text into pieces so the checked claims can be underlined where they appear. */
export function claimSegments(text: string, checks: Check[]): Segment[] {
  const byClaim = new Map<string, Check>();
  for (const c of checks) {
    const key = c.claim.trim();
    const prev = byClaim.get(key);
    if (!prev || RANK[c.status] > RANK[prev.status]) byClaim.set(key, c);
  }
  const lowerText = text.toLowerCase();
  const spans: { start: number; end: number; check: Check }[] = [];
  for (const [claim, check] of byClaim) {
    const needle = claim.toLowerCase().replace(/[.!?]+$/, "");
    if (needle.length < 3) continue;
    const start = lowerText.indexOf(needle);
    if (start !== -1) spans.push({ start, end: start + needle.length, check });
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end);
  const segments: Segment[] = [];
  let at = 0;
  for (const s of spans) {
    if (s.start < at) continue; // overlaps one already marked
    if (s.start > at) segments.push({ text: text.slice(at, s.start), status: null });
    segments.push({ text: text.slice(s.start, s.end), status: s.check.status, title: s.check.record });
    at = s.end;
  }
  if (at < text.length) segments.push({ text: text.slice(at), status: null });
  return segments.length ? segments : [{ text, status: null }];
}

/** Reasons, biggest impact first. Points that add trust come after the ones that add suspicion. */
export function sortedFactors(factors: Factor[]): Factor[] {
  return [...factors].sort((a, b) => b.points - a.points);
}
