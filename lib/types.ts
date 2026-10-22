export type Verdict = "Verified" | "Plausible" | "Suspicious" | "Unverifiable";
export type ClaimType =
  | "party_size"
  | "date_time"
  | "wait_time"
  | "item_ordered"
  | "reservation"
  | "bill"
  | "staff" // how staff behaved
  | "food_quality" // food was cold, bland and so on
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
  /** Which setup the review belongs to: the sample restaurant or the owner's own. */
  workspace?: "demo" | "own";
  /** Claims already pulled out (sample and example reviews), so checking it needs no AI call. */
  claims?: Claim[];
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

/** What the AI returns: only the claims it found. It never sees the records and never judges the review. */
export interface AiReading {
  is_review: boolean;
  claims: Claim[];
}

/** What kind of evidence a check is. Drives the weights in the score breakdown. */
export type CheckKind =
  | "impossible_capacity"
  | "impossible_closed"
  | "impossible_hours"
  | "no_bill"
  | "no_reservation"
  | "no_dish"
  | "no_free_tables"
  | "no_data" // no bills or reservations on file for that day, so nothing to compare with
  | "subjective" // wait time, staff, food quality and other opinions: records can't confirm these
  | "vague" // not enough detail (no day, time, party size or dish) to check
  | "order_found"
  | "reservation_found"
  | "dish_found"
  | "hours_ok";

/** Where a piece of evidence comes from. */
export type EvidenceSource = "POS bills" | "Reservations" | "Opening hours" | "Restaurant settings" | "Footfall";

export interface Check {
  /** Which claim this is evidence for. One claim can have several checks. */
  cid?: string;
  claim: string;
  record: string;
  status: Status;
  kind?: CheckKind;
  source?: EvidenceSource;
  /** What sort of claim this is (staff, wait time, party size...). */
  ctype?: ClaimType;
}

/** One line of the score breakdown. Positive points add suspicion, negative points add trust. */
export type FactorIcon =
  | "capacity"
  | "closed"
  | "hours"
  | "bill"
  | "reservation"
  | "dish"
  | "tables"
  | "burst"
  | "similar"
  | "wording"
  | "detail"
  | "trust";

export type FactorGroup = "mismatch" | "missing" | "signal" | "trust";

export interface Factor {
  label: string;
  points: number;
  icon?: FactorIcon;
  group?: FactorGroup;
  /** The claim this came from (matches `cid` on its checks). */
  checkId?: string;
}

/** How busy the restaurant was on the day the review says it visited. */
export interface Visit {
  date: string; // YYYY-MM-DD
  label: string; // e.g. "Fri 16 Oct"
  bills: number;
  covers: number; // guests seated
  rank: number; // 1 = busiest day on file
  daysOnFile: number;
}

export interface CheckResult {
  verdict: Verdict;
  confidence: number; // 0-100
  summary: string;
  score: number; // 0-100 suspicion score
  breakdown: Factor[];
  visit?: Visit | null;
  checks: Check[];
  burst: boolean;
  aiVerdict?: string; // older saved results only
}

export type CheckResponse =
  | { ok: true; result: CheckResult }
  | { ok: false; error: string; code?: ErrorCode; notReview?: boolean };

/** apology = genuine complaint; contact = can't confirm, so invite them to get in touch; factual = couldn't find the visit. */
export type ReplyApproach = "apology" | "contact" | "factual";
export type ReplyLanguage = "en" | "hi" | "hinglish";
export type ReplyStyle = "warm" | "professional" | "short";

export type ReplyResponse =
  | { ok: true; reply: string; warning?: string }
  | { ok: false; error: string; code?: ErrorCode };
