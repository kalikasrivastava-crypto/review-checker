import type { AiReading, Claim, ClaimType, Review } from "./types";

export const MIN_REVIEW_CHARS = 20;
const CLAIM_TYPES: ClaimType[] = [
  "party_size",
  "date_time",
  "wait_time",
  "item_ordered",
  "reservation",
  "bill",
  "staff",
  "food_quality",
  "other",
];

/** Checks what the owner typed, before the AI is called. Returns an error message or the clean review. */
export function validateReviewInput(input: unknown): { error: string } | { review: Review } {
  const body = (input ?? {}) as Record<string, unknown>;
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return { error: "Paste a review first." };
  if (text.length < MIN_REVIEW_CHARS) return { error: "That's too short to check." };

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Add the review's star rating (1 to 5)." };
  }
  const date = typeof body.date === "string" ? body.date : "";
  if (!date || Number.isNaN(new Date(date).getTime())) {
    return { error: "Add the date the review was posted." };
  }
  const id = typeof body.id === "string" ? body.id : undefined;
  const author = typeof body.author === "string" && body.author.trim() ? body.author.trim() : undefined;
  return { review: { id, rating, date, text, author } };
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Checks the AI's answer has the expected shape. Returns null if it doesn't. */
export function parseAiReading(raw: string): AiReading | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (typeof data.is_review !== "boolean") return null;
  if (!Array.isArray(data.claims)) return null;

  const claims: Claim[] = [];
  for (const c of data.claims as Record<string, unknown>[]) {
    if (!c || typeof c.text !== "string" || !c.text.trim()) continue;
    claims.push({
      text: c.text.trim(),
      // An unfamiliar label from the AI is treated as a general claim rather than failing the whole check.
      type: CLAIM_TYPES.includes(c.type as ClaimType) ? (c.type as ClaimType) : "other",
      party_size: typeof c.party_size === "number" ? c.party_size : null,
      weekday: str(c.weekday)?.toLowerCase() ?? null,
      date: str(c.date),
      time: str(c.time),
      item: str(c.item),
    });
  }
  return { is_review: data.is_review, claims };
}

export const MAX_OTHER_REVIEWS = 400;

/** The rest of the owner's inbox, sent along so bursts and look-alike wording can be spotted. */
export function sanitizeReviews(input: unknown): Review[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_OTHER_REVIEWS).flatMap((r): Review[] => {
    const x = r as Partial<Review>;
    const rating = Number(x?.rating);
    if (typeof x?.text !== "string" || typeof x?.date !== "string") return [];
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || Number.isNaN(new Date(x.date).getTime())) return [];
    return [
      {
        id: typeof x.id === "string" ? x.id.slice(0, 60) : undefined,
        author: typeof x.author === "string" ? x.author.slice(0, 60) : undefined,
        rating,
        date: x.date,
        text: x.text.slice(0, 2000),
      },
    ];
  });
}
