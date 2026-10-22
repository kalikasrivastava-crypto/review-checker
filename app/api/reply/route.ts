import { aiErrorMessage, AiError, askAI } from "@/lib/ai";
import { replySystem, replyUser } from "@/lib/prompts";
import { validateReviewInput } from "@/lib/validate";
import type { Check, ReplyResponse, ReplyTone, Review } from "@/lib/types";

const MAX_WORDS = 79;
const BANNED =
  /\b(camera|cameras|footage|records?|database|our system|refund|refunds|compensat\w*|liar|lying|lied|fake|fabricat\w*|fraud\w*)\b/i;
const MONEY = /[$£€₹]\s?\d|\b\d+(\.\d{2})?\s?(usd|gbp|eur|inr|dollars|pounds|euros|rupees)\b/i;
const BILL_ID = /\bB\d{3,}\b/;

// Allow time for the slower fallback model.
export const maxDuration = 40;

function reply(body: ReplyResponse, status = 200) {
  return Response.json(body, { status });
}

/** Plain-code check of the reply rules. Returns a warning, or undefined if the draft is fine. */
function ruleWarning(text: string, review: Review): string | undefined {
  const words = text.trim().split(/\s+/).length;
  if (words > MAX_WORDS) return `This draft is ${words} words. Trim it below 80 before posting.`;
  if (BANNED.test(text)) {
    return "This draft may mention records, refunds or accuse the reviewer. Edit it before posting.";
  }
  if (MONEY.test(text) || BILL_ID.test(text)) {
    return "This draft mentions an amount or a bill number. Remove it before posting.";
  }
  const firstName = review.author?.split(/\s+/)[0]?.replace(/[^A-Za-z]/g, "");
  if (firstName && firstName.length > 2 && new RegExp(`\\b${firstName}\\b`, "i").test(text)) {
    return "This draft uses the reviewer's name. Remove it before posting.";
  }
  return undefined;
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, error: "Couldn't draft a reply.", code: "bad_input" }, 400);
  }
  const checked = validateReviewInput(body.review);
  if ("error" in checked) return reply({ ok: false, error: checked.error, code: "bad_input" }, 400);
  const tone: ReplyTone = body.tone === "factual" ? "factual" : "apology";
  // Only the claim and its status go to the AI: record details (dates, party sizes, dishes) stay private.
  const checks = (Array.isArray(body.checks) ? (body.checks as Check[]) : []).map((c) => ({
    claim: String(c.claim),
    status: c.status,
  }));

  try {
    const text = await askAI(replySystem(tone), replyUser(checked.review, checks));
    return reply({ ok: true, reply: text, warning: ruleWarning(text, checked.review) });
  } catch (err) {
    const code = err instanceof AiError ? err.code : "unavailable";
    return reply({ ok: false, error: aiErrorMessage(code), code }, code === "no_key" ? 503 : 502);
  }
}
