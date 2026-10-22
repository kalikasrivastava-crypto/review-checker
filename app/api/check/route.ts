import { askAI, AiError, aiErrorMessage } from "@/lib/ai";
import { checkClaim, finalRisk, isBurst } from "@/lib/checks";
import { SCORE_SYSTEM, scoreUser } from "@/lib/prompts";
import { parseAiReading, validateReviewInput } from "@/lib/validate";
import type { AiReading, CheckResponse } from "@/lib/types";

function reply(body: CheckResponse, status = 200) {
  return Response.json(body, { status });
}

export async function POST(request: Request) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return reply({ ok: false, error: "Paste a review first." }, 400);
  }

  const checked = validateReviewInput(input);
  if ("error" in checked) return reply({ ok: false, error: checked.error }, 400);
  const { review } = checked;

  // AI call 1: read the review. One automatic retry if the answer isn't valid JSON.
  let reading: AiReading | null = null;
  try {
    for (let attempt = 0; attempt < 2 && !reading; attempt++) {
      reading = parseAiReading(await askAI(SCORE_SYSTEM, scoreUser(review), true));
    }
  } catch (err) {
    const code = err instanceof AiError ? err.code : "unavailable";
    return reply({ ok: false, error: aiErrorMessage(code) }, code === "no_key" ? 503 : 502);
  }
  if (!reading) {
    return reply({ ok: false, error: "Couldn't read the AI's answer. Try again." }, 502);
  }
  if (!reading.is_review) {
    return reply({ ok: false, notReview: true, error: "This doesn't look like a review." });
  }

  // Plain code from here: look up claims, apply the burst rule, settle the risk.
  const reviewDate = new Date(review.date);
  const evidence = reading.claims.map((c) => checkClaim(c, reviewDate));
  const mismatches = evidence.filter((e) => e.status === "mismatch").length;
  const burst = isBurst(review);
  const risk = finalRisk(reading.risk, mismatches, burst);

  const reasons: string[] = [];
  if (mismatches > 0) {
    reasons.push(
      `${mismatches === 1 ? "A claim doesn't" : `${mismatches} claims don't`} match your records.`,
    );
  }
  if (burst) reasons.push("3 or more one-star reviews were posted within 24 hours.");
  reasons.push(...reading.reasons);

  return reply({
    ok: true,
    result: { risk, aiRisk: reading.risk, reasons: reasons.slice(0, 3), burst, evidence },
  });
}
