import { aiErrorMessage, AiError, askAI } from "@/lib/ai";
import { replySystem, replyUser } from "@/lib/prompts";
import { userClient } from "@/lib/supabase-server";
import { validateReviewInput } from "@/lib/validate";
import type { Check, ReplyApproach, ReplyLanguage, ReplyResponse, ReplyStyle, Review } from "@/lib/types";

const MAX_WORDS = 79;
const SHORT_MAX_WORDS = 40;
const BANNED =
  /\b(camera|cameras|cctv|footage|records?|database|our system|refund|refunds|compensat\w*|liar|lying|lied|fake|fabricat\w*|fraud\w*|jhooth\w*|jhutha|nakli|dhokha|paise wapas)\b/i;
// \b does not work with Devanagari, so these are matched on their own.
const BANNED_HINDI = /(रिफंड|पैसे वापस|धोखा|झूठ|नकली|कैमरा|सीसीटीवी|रिकॉर्ड)/;
const MONEY = /[$£€₹]\s?\d|\b\d+(\.\d{2})?\s?(usd|gbp|eur|inr|dollars|pounds|euros|rupees)\b/i;
const BILL_ID = /\bB\d{3,}\b/;

// Allow time for the slower fallback model.
export const maxDuration = 40;

function reply(body: ReplyResponse, status = 200) {
  return Response.json(body, { status });
}

/** Plain-code check of the reply rules. Returns a warning, or undefined if the draft is fine. */
function ruleWarning(text: string, review: Review, style: ReplyStyle): string | undefined {
  const words = text.trim().split(/\s+/).length;
  if (style === "short" && words > SHORT_MAX_WORDS) return `This draft is ${words} words. A short reply should stay under 40.`;
  if (words > MAX_WORDS) return `This draft is ${words} words. Trim it below 80 before posting.`;
  if (BANNED.test(text) || BANNED_HINDI.test(text)) {
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
  const sb = userClient(request);
  if (!sb || (await sb.auth.getUser()).error) return reply({ ok: false, error: "Please log in again.", code: "bad_input" }, 401);
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, error: "Couldn't draft a reply.", code: "bad_input" }, 400);
  }
  const checked = validateReviewInput(body.review);
  if ("error" in checked) return reply({ ok: false, error: checked.error, code: "bad_input" }, 400);
  const wanted = body.approach ?? body.tone;
  const approach: ReplyApproach = wanted === "factual" ? "factual" : wanted === "contact" ? "contact" : "apology";
  const language: ReplyLanguage = body.language === "hi" || body.language === "hinglish" ? body.language : "en";
  const style: ReplyStyle = body.style === "professional" || body.style === "short" ? body.style : "warm";
  // Only the claim and its status go to the AI: record details (dates, party sizes, dishes) stay private.
  const checks = (Array.isArray(body.checks) ? (body.checks as Check[]) : []).map((c) => ({
    claim: String(c.claim),
    status: c.status,
  }));

  // The owner's phone or email is filled in afterwards. It never goes to the AI.
  const contact = typeof body.contact === "string" ? body.contact.trim().slice(0, 120) : "";

  try {
    let text = await askAI(replySystem({ approach, language, style }), replyUser(checked.review, checks));
    if (contact) text = text.replace(/\[phone or email\]/gi, contact);
    return reply({ ok: true, reply: text, warning: ruleWarning(text, checked.review, style) });
  } catch (err) {
    const code = err instanceof AiError ? err.code : "unavailable";
    return reply({ ok: false, error: aiErrorMessage(code), code }, code === "no_key" ? 503 : 502);
  }
}
