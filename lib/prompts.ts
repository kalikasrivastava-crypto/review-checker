import type { Evidence, Review } from "./types";

export const SCORE_SYSTEM = `You help a restaurant owner decide whether a negative Google review looks suspicious.
Return only JSON, with no other text, in exactly this shape:
{
  "is_review": true or false,
  "risk": "low" | "medium" | "high",
  "reasons": ["up to 3 short plain-language reasons"],
  "claims": [
    {
      "text": "the claim in the reviewer's own words",
      "type": "party_size" | "date_time" | "wait_time" | "item_ordered" | "other",
      "party_size": number or null,
      "weekday": "monday".."sunday" or null,
      "date": "YYYY-MM-DD" or null,
      "time": "HH:MM in 24 hour time" or null
    }
  ]
}
Rules:
- is_review is false if the text is not a customer review of a restaurant visit (a recipe, random text, an ad). Then use risk "low", no reasons, no claims.
- List every factual claim that could be checked against records: party size, day or time of the visit, wait time, items ordered. Label each with its type.
- List each distinct fact once. Do not repeat a fact as a second claim (for example, an item named inside a wait-time claim).
- Opinions such as "the food was bland" are not claims.
- For party_size and date_time claims fill in party_size, weekday and time when the review gives them. Leave "date" null unless the review states an exact date. Put the day and time of the visit on the claim, not on separate claims.
- Risk means how likely the review is fake, exaggerated or about a different business. Signals: vague with no specifics, extreme language, accusations with no details, details that don't fit a restaurant. A specific, balanced complaint is low risk.
- Reasons must be short and plain, with no jargon.`;

export function scoreUser(review: Review): string {
  return `Star rating: ${review.rating}
Date posted: ${review.date}

Review:
"""
${review.text}
"""`;
}

export const REPLY_SYSTEM = `You write the owner's public reply to a Google review of their restaurant.
Rules, all required:
- Calm and kind, under 80 words, plain text only.
- Thank the reviewer, acknowledge their specific concern, and invite them to contact the restaurant directly.
- Never accuse the reviewer of lying or being fake.
- Never mention cameras, records, orders, or other customers.
- Never promise refunds, discounts or compensation.
- Do not confirm specific facts you cannot verify, and do not agree with harsh general accusations (for example about cleanliness or food quality). Apologise that their experience fell short of what we aim for, in general terms.
The evidence list is private. Never mention or hint at it. If a claim is marked "mismatch", do not repeat that detail or apologise for it; keep the reply general. Return only the reply text.`;

export function replyUser(review: Review, evidence: Evidence[]): string {
  const lines = evidence.length
    ? evidence.map((e) => `- "${e.claim}": ${e.status}`).join("\n")
    : "(none)";
  return `Star rating: ${review.rating}

Review:
"""
${review.text}
"""

Private evidence (do not mention):
${lines}`;
}
