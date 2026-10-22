import type { Check, ReplyApproach, ReplyLanguage, ReplyStyle, Review } from "./types";

export const SCORE_SYSTEM = `You help a restaurant owner by pulling the claims out of a Google review.
You do NOT judge whether the review is true or fair. You never see the restaurant's records, and you never compare anything with them. Your only job is to list what the reviewer claims.
Return only JSON, with no other text, in exactly this shape:
{
  "is_review": true or false,
  "claims": [
    {
      "text": "the claim, copied exactly from the review so it can be found in it",
      "type": "party_size" | "date_time" | "reservation" | "bill" | "item_ordered" | "wait_time" | "staff" | "food_quality" | "other",
      "party_size": number or null,
      "weekday": "monday".."sunday" or null,
      "date": "YYYY-MM-DD" or null,
      "time": "HH:MM in 24 hour time" or null,
      "item": "dish name" or null
    }
  ]
}
Rules:
- is_review is false if the text is not a customer review of a restaurant visit (a recipe, random text, an ad). Then return an empty claims list.
- Split the review into separate claims and list every one, including opinions: "staff was rude" is a staff claim, "food was cold" is a food_quality claim, "waited 45 minutes" is a wait_time claim.
- Copy each claim's words exactly as written in the review. Do not rephrase.
- If the reviewer states how many people and when together ("table of 10 on Friday around 8 PM"), make ONE party_size claim with party_size, weekday and time all filled in.
- date_time is for when the visit happened, when it is stated without a party size. reservation is for a booking they say they made. bill is only for something they say they paid or were charged, never for an opinion about prices. item_ordered is for a dish, with the dish in "item".
- Leave "date" null unless the review gives an exact date. Use null for anything the review doesn't say.
- List each distinct fact once.`;

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
