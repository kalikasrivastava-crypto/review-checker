import { aiErrorMessage, AiError, askAI } from "@/lib/ai";
import { buildChecks, isBurst, settleVerdict } from "@/lib/checks";
import { loadDefaultRecords } from "@/lib/records-default";
import { sanitizeUploaded, type Records } from "@/lib/records";
import { SCORE_SYSTEM, scoreUser } from "@/lib/prompts";
import { parseAiReading, validateReviewInput } from "@/lib/validate";
import type { AiReading, CheckResponse } from "@/lib/types";

function reply(body: CheckResponse, status = 200) {
  return Response.json(body, { status });
}

/**
 * The owner's own upload if there is one, otherwise the demo dataset. With an upload, a file that was
 * not provided counts as "no records" rather than falling back to demo data.
 */
function recordsFor(input: unknown): Records {
  const base = loadDefaultRecords();
  const custom = sanitizeUploaded((input as { records?: unknown } | null)?.records);
  return custom ? { ...base, orders: custom.orders, reservations: custom.reservations } : base;
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

  // Plain code from here: check claims against the records, apply the burst rule, settle the verdict.
  const checks = buildChecks(reading.claims, new Date(review.date), recordsFor(input));
  const burst = isBurst(review);
  const settled = settleVerdict(reading, checks, burst);

  return reply({
    ok: true,
    result: { ...settled, checks, burst, aiVerdict: reading.verdict },
  });
}
