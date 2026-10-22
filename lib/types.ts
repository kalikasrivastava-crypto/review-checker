export type Risk = "low" | "medium" | "high";
export type ClaimType = "party_size" | "date_time" | "wait_time" | "item_ordered" | "other";
export type Status = "match" | "mismatch" | "no_data";

export interface Review {
  id?: string;
  rating: number;
  date: string; // local time, e.g. 2026-10-20T21:30:00
  text: string;
  author?: string;
}

export interface Claim {
  text: string;
  type: ClaimType;
  party_size: number | null;
  weekday: string | null;
  date: string | null; // YYYY-MM-DD, only if the review states an exact date
  time: string | null; // HH:MM, 24 hour
}

export interface AiReading {
  is_review: boolean;
  risk: Risk;
  reasons: string[];
  claims: Claim[];
}

export interface Evidence {
  claim: string;
  type: ClaimType;
  status: Status;
  note: string;
}

export interface CheckResult {
  risk: Risk;
  aiRisk: Risk;
  reasons: string[];
  burst: boolean;
  evidence: Evidence[];
}

export type CheckResponse =
  | { ok: true; result: CheckResult }
  | { ok: false; error: string; notReview?: boolean };

export type ReplyResponse =
  | { ok: true; reply: string; warning?: string }
  | { ok: false; error: string };
