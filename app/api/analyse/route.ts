import { AiError, askAI, type AiErrorCode } from "@/lib/ai";
import {
  AI_BATCH_SIZE,
  AI_RESPONSE_SCHEMA,
  AI_SYSTEM,
  AiFormatError,
  MAX_AI_REVIEWS,
  MAX_REVIEW_CHARS,
  aiUserMessage,
  mergeBatches,
  parseAiLabels,
  redactText,
  type AiLabels,
} from "@/lib/ai-analysis";

// Reading a few hundred reviews takes longer than writing one reply.
export const maxDuration = 60;

// Each visitor address can run a few AI analyses an hour. This guards the owner's free quota, and it is
// per server instance, so it is a safety net rather than a hard limit.
const hits = new Map<string, number[]>();
const LIMIT = 12;
const MAX_BODY_CHARS = 600_000;

type Reason = "no_key" | "busy" | "timeout" | "invalid" | "too_many" | "rate_limited" | "unavailable";
const fail = (reason: Reason) => Response.json({ ok: false, reason });

const REASON_FOR: Record<AiErrorCode, Reason> = {
  no_key: "no_key",
  busy: "busy",
  timeout: "timeout",
  refused: "invalid",
  empty: "invalid",
  unavailable: "unavailable",
};

/**
 * AI analysis. The browser sends only review text and star ratings (reviewer names are never included). Gemini
 * labels each review; this route checks the answer and returns the labels. It never returns counts. If anything
 * goes wrong it answers { ok: false, reason } and the page falls back to the keyword rules.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_BODY_CHARS) return Response.json({ ok: false, reason: "too_many" }, { status: 413 });
  let body: { reviews?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  }
  const list = body.reviews;
  if (!Array.isArray(list) || list.length === 0) return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
  if (list.length > MAX_AI_REVIEWS) return fail("too_many");

  const reviews: { id: number; rating: number | null; text: string }[] = [];
  for (const [id, item] of list.entries()) {
    const r = item as { text?: unknown; rating?: unknown } | null;
    if (!r || typeof r.text !== "string") return Response.json({ ok: false, reason: "invalid" }, { status: 400 });
    const rating = typeof r.rating === "number" && r.rating >= 1 && r.rating <= 5 ? r.rating : null;
    // Redact again here, so this route is safe even if called without the page's own clean-up.
    reviews.push({ id, rating, text: redactText(r.text).slice(0, MAX_REVIEW_CHARS) });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= LIMIT) return fail("rate_limited");
  hits.set(ip, [...recent, now]);

  const batches: { id: number; rating: number | null; text: string }[][] = [];
  for (let i = 0; i < reviews.length; i += AI_BATCH_SIZE) {
    // Ids restart at 0 in each batch, so the answer's ids are small and easy to check.
    batches.push(reviews.slice(i, i + AI_BATCH_SIZE).map((r, k) => ({ ...r, id: k })));
  }

  try {
    const answers: AiLabels[] = await Promise.all(
      batches.map(async (batch) => {
        const ask = () => askAI(AI_SYSTEM, aiUserMessage(batch), true, { maxOutputTokens: 16000, timeoutMs: 55_000, responseSchema: AI_RESPONSE_SCHEMA });
        try {
          return parseAiLabels(await ask(), batch.length);
        } catch (err) {
          // An answer that fails our checks gets one more try. Failures to reach Gemini are not retried.
          if (!(err instanceof AiFormatError)) throw err;
          return parseAiLabels(await ask(), batch.length);
        }
      }),
    );
    const merged = mergeBatches(
      answers,
      batches.map((_, i) => i * AI_BATCH_SIZE),
    );
    return Response.json({ ok: true, labels: merged.labels, steps: merged.steps });
  } catch (err) {
    if (err instanceof AiError) {
      console.error("AI analysis: Gemini call failed:", err.code);
      return fail(REASON_FOR[err.code]);
    }
    if (err instanceof AiFormatError) {
      console.error("AI analysis: answer rejected:", err.message);
      return fail("invalid");
    }
    console.error("AI analysis failed:", err instanceof Error ? err.message : err);
    return fail("unavailable");
  }
}
