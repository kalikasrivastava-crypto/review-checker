import { askAI, AiError, aiErrorMessage } from "@/lib/ai";
import { REPLY_SYSTEM, replyUser } from "@/lib/prompts";
import { validateReviewInput } from "@/lib/validate";
import type { Evidence, ReplyResponse } from "@/lib/types";

const MAX_WORDS = 79;
const BANNED = /\b(camera|cameras|footage|records?|refund|refunds|compensat\w*|liar|lying|lied|fake|fabricat\w*|fraud\w*)\b/i;

function reply(body: ReplyResponse, status = 200) {
  return Response.json(body, { status });
}

/** Plain-code check of the four reply rules. Returns a warning, or undefined if the draft is fine. */
function ruleWarning(text: string): string | undefined {
  const words = text.trim().split(/\s+/).length;
  if (words > MAX_WORDS) return `This draft is ${words} words. Trim it below 80 before posting.`;
  if (BANNED.test(text)) {
    return "This draft may mention records, refunds or accuse the reviewer. Edit it before posting.";
  }
  return undefined;
}

export async function POST(request: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, error: "Couldn't draft a reply." }, 400);
  }
  const checked = validateReviewInput(body.review);
  if ("error" in checked) return reply({ ok: false, error: checked.error }, 400);
  const evidence = Array.isArray(body.evidence) ? (body.evidence as Evidence[]) : [];

  try {
    const text = await askAI(REPLY_SYSTEM, replyUser(checked.review, evidence));
    return reply({ ok: true, reply: text, warning: ruleWarning(text) });
  } catch (err) {
    const code = err instanceof AiError ? err.code : "unavailable";
    return reply({ ok: false, error: aiErrorMessage(code) }, code === "no_key" ? 503 : 502);
  }
}
