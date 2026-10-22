import { aiErrorMessage, AiError, askAI } from "@/lib/ai";
import { buildChecks, isBurst, settleVerdict, visitInfo } from "@/lib/checks";
import { mostSimilar } from "@/lib/similarity";
import { buildRecords } from "@/lib/records-server";
import { SCORE_SYSTEM, scoreUser } from "@/lib/prompts";
import { parseAiReading, sanitizeReviews, validateReviewInput } from "@/lib/validate";
import type { AiReading, CheckResponse } from "@/lib/types";

// Allow time for the slower fallback model.
export const maxDuration = 40;

function reply(body: CheckResponse, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return reply({ ok: false, error: "Paste a review first.", code: "bad_input" }, 400);
  }

  const checked = validateReviewInput(input);
  if ("error" in checked) return reply({ ok: false, error: checked.error, code: "bad_input" }, 400);
  const { review } = checked;

  // AI call 1: read the review. One automatic retry if the answer isn't valid JSON.
  let reading: AiReading | null = null;
  try {
    for (let attempt = 0; attempt < 2 && !reading; attempt++) {
      reading = parseAiReading(await askAI(SCORE_SYSTEM, scoreUser(review), true));
    }
  } catch (err) {
    const code = err instanceof AiError ? err.code : "unavailable";
    return reply({ ok: false, error: aiErrorMessage(code), code }, code === "no_key" ? 503 : 502);
  }
  if (!reading) {
    return reply({ ok: false, error: "Couldn't read the AI's answer. Try again.", code: "unreadable" }, 502);
  }
  if (!reading.is_review) {
    return reply({ ok: false, notReview: true, error: "This doesn't look like a review." });
  }

  // Plain code from here: check claims against the records, apply the burst rule, settle the verdict.
  const { records } = buildRecords(
    (input as { records?: unknown } | null)?.records,
    (input as { settings?: unknown } | null)?.settings,
  );
  const checks = buildChecks(reading.claims, new Date(review.date), records);
  const visit = visitInfo(reading.claims, new Date(review.date), records);
  const others = sanitizeReviews((input as { others?: unknown })?.others);
  const burst = isBurst(review, others.length ? [...others, review] : [review]);
  const similar = mostSimilar(review, others);
  const settled = settleVerdict({ ai: reading, checks, burst, text: review.text, similar });

  return reply({
    ok: true,
    result: { ...settled, checks, burst, aiVerdict: reading.verdict, visit },
  });
}
