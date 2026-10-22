import type { Check, ReplyApproach, ReplyLanguage, ReplyStyle, Review } from "./types";

export const SCORE_SYSTEM = `You help a restaurant owner decide whether a negative Google review looks genuine.
You see only the review text. You do NOT see the restaurant's records, so never claim a fact is confirmed.
Return only JSON, with no other text, in exactly this shape:
{
  "is_review": true or false,
  "verdict": "Plausible" | "Suspicious" | "Unverifiable",
  "confidence": number from 0 to 100,
  "summary": "one plain sentence",
  "claims": [
    {
      "text": "the claim in the reviewer's own words",
      "type": "party_size" | "date_time" | "wait_time" | "item_ordered" | "reservation" | "bill" | "other",
      "party_size": number or null,
      "weekday": "monday".."sunday" or null,
      "date": "YYYY-MM-DD" or null,
      "time": "HH:MM in 24 hour time" or null,
      "item": "dish name" or null
    }
  ]
}
Rules:
- is_review is false if the text is not a customer review of a restaurant visit (a recipe, random text, an ad). Then use verdict "Unverifiable", confidence 0, an empty summary and no claims.
- verdict: "Suspicious" if the text itself looks fake or exaggerated (vague, extreme language, accusations with no details, details that don't fit a restaurant). "Plausible" if it is specific and balanced. "Unverifiable" if there is too little to judge.
- confidence is how sure you are of that verdict.
- List every factual claim that could be checked against records: party size, day or time of the visit, a reservation, a bill or payment, wait time, items ordered. Label each with its type.
- Opinions such as "the food was bland" are not claims.
- List each distinct fact once. Do not repeat a fact as a second claim.
- Fill in weekday, time and party_size only on the claim they belong to: a party_size claim carries party_size, a date_time claim carries weekday and time. A wait_time or other claim never carries party_size, weekday or time. Leave "date" null unless the review states an exact date. For item_ordered claims put the dish in "item".
- Use date_time for when the visit happened and party_size for how many people; do not merge them into one claim.
- Reasons stay short and plain, with no jargon.`;

export function scoreUser(review: Review): string {
  return `Star rating: ${review.rating}
Date posted: ${review.date}

Review:
"""
${review.text}
"""`;
}

const REPLY_RULES = `You write the owner's public reply to a Google review of their restaurant.
Rules, all required:
- Plain text only, no emoji, no hashtags.
- Never accuse the reviewer of lying or being fake.
- Never mention cameras, CCTV, records, orders, bills or other customers.
- Never include the reviewer's name, any money amounts, bill or booking numbers, or other private details.
- Never promise refunds, discounts or compensation.
- Do not confirm specific facts you cannot verify, and do not agree with harsh general accusations (for example about cleanliness or food quality).
- Where the reviewer should get in touch, write the placeholder [phone or email] exactly, in English letters. The owner fills it in.
The evidence list is private. Never mention or hint at it. If a claim is marked "mismatch", do not repeat that detail or apologise for it; keep the reply general. Return only the reply text.`;

const REPLY_APPROACHES: Record<ReplyApproach, string> = {
  apology: `Approach: a genuine complaint. Thank the reviewer, apologise sincerely that their experience fell short, acknowledge the specific kind of problem they describe in general terms, and say what you will do to put it right (for example, talk it through with the team) without inventing specifics. Invite them to contact the restaurant at [phone or email].`,
  contact: `Approach: polite and neutral, because the review could not be fully confirmed. Thank the reviewer, say you take every review to heart and would like to understand what happened, and ask them to contact the restaurant at [phone or email]. Do not apologise for specific details, do not say you could not find their visit, and do not repeat numbers or times from the review.`,
  factual: `Approach: polite and factual, because the visit could not be verified. Thank the reviewer for the feedback, say every review is taken seriously, say you were unable to find a visit matching the details described, and invite them to contact the restaurant at [phone or email] so you can look into it. Do not apologise for specific details, do not repeat numbers or times from the review, and do not say where you looked (no "system", "database" or "records").`,
};

const REPLY_LANGUAGES: Record<ReplyLanguage, string> = {
  en: "Language: English.",
  hi: "Language: Hindi, written in Devanagari script (हिन्दी). Use simple, polite, everyday Hindi that a restaurant owner would really write. Only the placeholder [phone or email] stays in English letters.",
  hinglish:
    "Language: Hinglish, which is Hindi written in Roman (English) letters, mixed naturally with common English words, the way people write on WhatsApp. Do not use Devanagari script. Keep it polite and respectful.",
};

const REPLY_STYLES: Record<ReplyStyle, string> = {
  warm: "Style: warm, personal and gentle, as if the owner is speaking. No more than 70 words.",
  professional: "Style: polite, formal and measured, like a hotel manager. No more than 70 words.",
  short: "Style: very short. Two or three sentences, no more than 35 words.",
};

export function replySystem(opts: { approach: ReplyApproach; language: ReplyLanguage; style: ReplyStyle }): string {
  return [
    REPLY_RULES,
    REPLY_APPROACHES[opts.approach],
    REPLY_LANGUAGES[opts.language],
    REPLY_STYLES[opts.style],
  ].join("\n");
}

export function replyUser(review: Review, checks: Pick<Check, "claim" | "status">[]): string {
  const lines = checks.length ? checks.map((e) => `- "${e.claim}": ${e.status}`).join("\n") : "(none)";
  return `Star rating: ${review.rating}

Review:
"""
${review.text}
"""

Private evidence (do not mention):
${lines}`;
}
