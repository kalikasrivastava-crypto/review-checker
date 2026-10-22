export type Verdict = "Verified" | "Plausible" | "Suspicious" | "Unverifiable";
export type ClaimType =
  | "party_size"
  | "date_time"
  | "wait_time"
  | "item_ordered"
  | "reservation"
  | "bill"
  | "other";
export type Status = "match" | "mismatch" | "no_record";

export interface Review {
  id?: string;
  rating: number;
  date: string; // local time, e.g. 2026-10-20T21:30:00
  text: string;
  author?: string;
}

/** A review in the inbox: always has an id. */
export interface ReviewItem extends Review {
  id: string;
  author: string;
  source: "demo" | "added";
}

export type ErrorCode = "no_key" | "busy" | "timeout" | "unavailable" | "refused" | "empty" | "bad_input" | "unreadable";

export interface Claim {
  text: string;
  type: ClaimType;
  party_size: number | null;
  weekday: string | null;
  date: string | null; // YYYY-MM-DD, only if the review states an exact date
  time: string | null; // HH:MM, 24 hour
  item: string | null; // dish named in an item_ordered claim
}

/** What the AI returns. It never sees the restaurant's records. */
export interface AiReading {
  is_review: boolean;
  verdict: "Plausible" | "Suspicious" | "Unverifiable";
  confidence: number; // 0-100
  summary: string;
  claims: Claim[];
}

export interface Check {
  claim: string;
  record: string;
  status: Status;
}

export interface CheckResult {
  verdict: Verdict;
  confidence: number; // 0-100
  summary: string;
  checks: Check[];
  burst: boolean;
  aiVerdict: AiReading["verdict"];
}

export type CheckResponse =
  | { ok: true; result: CheckResult }
  | { ok: false; error: string; code?: ErrorCode; notReview?: boolean };

/** apology = genuine complaint (apology plus a fix); factual = can't verify it (polite, no admissions). */
export type ReplyTone = "apology" | "factual";

export type ReplyResponse =
  | { ok: true; reply: string; warning?: string }
  | { ok: false; error: string; code?: ErrorCode };
