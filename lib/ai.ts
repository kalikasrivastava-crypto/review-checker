// One small helper that calls the Gemini API. The key is read on the server from .env.local.
// gemini-3.6-flash answered in about 2-6 s in testing. Set GEMINI_MODEL in .env.local to try another.
const MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-3.6-flash";
// If a model's free quota is used up (HTTP 429), try the next one before giving up.
const FALLBACK_MODELS = (process.env.GEMINI_FALLBACK_MODELS?.trim() || "gemini-3.8-flash,gemini-3.5-flash-lite")
  .split(",")
  .map((m) => m.trim())
  .filter((m) => m && m !== MODEL);
const TIMEOUT_MS = 9000;
const FALLBACK_TIMEOUT_MS = 25000; // the fallback model is slower, and it only runs when the main one is out of quota

export type AiErrorCode = "no_key" | "busy" | "timeout" | "unavailable" | "refused" | "empty";

export class AiError extends Error {
  constructor(public code: AiErrorCode) {
    super(code);
  }
}

/** Plain-language message for each failure; never reveals the key's name. */
export function aiErrorMessage(code: AiErrorCode): string {
  switch (code) {
    case "no_key":
      return "The AI service isn't set up.";
    case "busy":
      return "The AI is busy right now. Wait a minute and try again.";
    case "timeout":
      return "The AI took too long to answer. Try again.";
    case "refused":
      return "The AI couldn't handle this text. Try a different review.";
    default:
      return "The AI service isn't available right now. Try again.";
  }
}

function send(apiKey: string, model: string, system: string, user: string, json: boolean, signal: AbortSignal, maxTokens: number, schema?: object) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        // Short thinking keeps answers around 2 seconds instead of 6+.
        thinkingConfig: { thinkingLevel: "low" },
        ...(json ? { responseMimeType: "application/json" } : {}),
        ...(json && schema ? { responseSchema: schema } : {}),
      },
    }),
    signal,
  });
}

export interface AskOptions {
  /** Longer jobs (like labelling a batch of reviews) need more room and time. Defaults suit one short reply. */
  maxOutputTokens?: number;
  timeoutMs?: number;
  /** Skip the slower fallback models, so a caller with its own fallback can fail fast. */
  noModelFallback?: boolean;
  /** Gemini response schema (OpenAPI subset). Makes the JSON shape much more reliable. */
  responseSchema?: object;
}

export async function askAI(system: string, user: string, json = false, opts: AskOptions = {}): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "PASTE_YOUR_KEY_HERE") throw new AiError("no_key");

  const maxTokens = opts.maxOutputTokens ?? 2000;
  let signal = AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS); // one deadline for the call and its retry
  let res: Response;
  try {
    res = await send(apiKey, MODEL, system, user, json, signal, maxTokens, opts.responseSchema);
    for (const fallback of opts.noModelFallback ? [] : FALLBACK_MODELS) {
      if (res.status !== 429) break;
      signal = AbortSignal.timeout(opts.timeoutMs ?? FALLBACK_TIMEOUT_MS);
      res = await send(apiKey, fallback, system, user, json, signal, maxTokens, opts.responseSchema);
    }
    // Gemini sometimes answers "high demand" (503). One quick retry usually gets through.
    if (res.status === 503) {
      await new Promise((r) => setTimeout(r, 500));
      res = await send(apiKey, MODEL, system, user, json, signal, maxTokens, opts.responseSchema);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") throw new AiError("timeout");
    throw new AiError("unavailable");
  }

  if (res.status === 401 || res.status === 403) throw new AiError("no_key");
  if (res.status === 429 || res.status === 503) throw new AiError("busy");
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("AI request failed:", res.status, body.slice(0, 300));
    throw new AiError(body.includes("API_KEY_INVALID") ? "no_key" : "unavailable");
  }

  const data = await res.json().catch(() => null);
  if (data?.promptFeedback?.blockReason) throw new AiError("refused");
  const candidate = data?.candidates?.[0];
  if (candidate?.finishReason === "SAFETY") throw new AiError("refused");
  const text: string = (candidate?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();
  if (!text) {
    console.error("AI returned no text:", candidate?.finishReason);
    throw new AiError("empty");
  }
  return text;
}
