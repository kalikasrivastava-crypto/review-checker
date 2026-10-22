import { aiErrorMessage, AiError, askAI } from "@/lib/ai";
import { buildChecks, isBurst, settleVerdict, visitInfo } from "@/lib/checks";
import { mostSimilar } from "@/lib/similarity";
import { SCORE_SYSTEM, scoreUser } from "@/lib/prompts";
import { hashString } from "@/lib/sig";
import { checkSignature } from "@/lib/settings";
import { loadRecords, signedInClient, type RestaurantRow } from "@/lib/supabase-server";
import { normalizeClaims, parseAiReading, validateReviewInput } from "@/lib/validate";
import type { AiReading, CheckResponse } from "@/lib/types";

// Allow time for the slower fallback model.
export const maxDuration = 40;

function reply(body: CheckResponse, status = 200) {
  return Response.json(body, { status });
}

/**
 * Checks one saved review. Everything is read from the database as the signed-in owner (so only their own
 * data is visible). The AI reads only the review text, and only once: the claims it finds are saved with the review.
 */
export async function POST(request: Request) {
  const sb = await signedInClient(request);
  if (!sb) return reply({ ok: false, error: "Please log in again.", code: "bad_input" }, 401);
  let reviewId = "";
  try {
    reviewId = String(((await request.json()) as { reviewId?: unknown })?.reviewId ?? "");
  } catch {
    return reply({ ok: false, error: "Pick a review first.", code: "bad_input" }, 400);
  }

  const { data: row } = await sb.from("reviews").select("*").eq("id", reviewId).maybeSingle();
  if (!row) return reply({ ok: false, error: "That review wasn't found.", code: "bad_input" }, 404);
  const { data: restaurant } = await sb.from("restaurants").select("id,settings,records_version").eq("id", row.restaurant_id).maybeSingle();
  if (!restaurant) return reply({ ok: false, error: "That restaurant wasn't found.", code: "bad_input" }, 404);

  const checked = validateReviewInput({ text: row.text, rating: row.rating, date: row.date, author: row.author });
  if ("error" in checked) return reply({ ok: false, error: checked.error, code: "bad_input" }, 400);
  const { review } = checked;

  // Claims saved earlier (sample reviews, or an earlier AI read of this exact text) mean no AI call.
  const textHash = hashString(review.text);
  const saved = row.claims && (!row.claims_hash || row.claims_hash === textHash) ? normalizeClaims(row.claims) : [];
  let reading: AiReading | null = saved.length > 0 ? { is_review: true, claims: saved } : null;
  let askedAi = false;
  try {
    for (let attempt = 0; attempt < 2 && !reading; attempt++) {
      askedAi = true;
      reading = parseAiReading(await askAI(SCORE_SYSTEM, scoreUser(review), true));
    }
  } catch (err) {
    const code = err instanceof AiError ? err.code : "unavailable";
    return reply({ ok: false, error: aiErrorMessage(code), code }, code === "no_key" ? 503 : 502);
  }
  if (!reading) return reply({ ok: false, error: "Couldn't read the AI's answer. Try again.", code: "unreadable" }, 502);
  if (!reading.is_review) {
    await sb.from("reviews").update({ note: "Doesn't look like a review", claims: [], claims_hash: textHash }).eq("id", row.id);
    return reply({ ok: false, notReview: true, error: "This doesn't look like a review." });
  }
  if (askedAi) await sb.from("reviews").update({ claims: reading.claims, claims_hash: textHash }).eq("id", row.id);

  // Plain code from here: check claims against the records, apply the burst rule, settle the verdict.
  const rest = restaurant as RestaurantRow;
  const { records } = await loadRecords(sb, rest);
  const { data: otherRows } = await sb
    .from("reviews")
    .select("id,author,rating,date,text")
    .eq("restaurant_id", rest.id)
    .neq("id", row.id)
    .limit(400);
  const others = (otherRows ?? []).map((o) => ({ id: o.id as string, author: o.author as string, rating: Number(o.rating), date: o.date as string, text: o.text as string }));
  const checks = buildChecks(reading.claims, new Date(review.date), records);
  const visit = visitInfo(reading.claims, new Date(review.date), records);
  const burst = isBurst(review, others.length ? [...others, review] : [review]);
  const similar = mostSimilar(review, others);
  const settled = settleVerdict({ checks, burst, text: review.text, similar });
  const result = { ...settled, checks, burst, visit };

  const sig = checkSignature(review, rest.settings, Number(rest.records_version));
  const checkedAt = new Date().toISOString();
  await sb.from("case_reports").upsert({ review_id: row.id, restaurant_id: rest.id, result, sig, checked_at: checkedAt });
  await sb
    .from("reviews")
    .update({ status: row.status === "replied" || row.status === "reported" ? row.status : "checked", note: null })
    .eq("id", row.id);

  return reply({ ok: true, result, sig, checkedAt });
}
