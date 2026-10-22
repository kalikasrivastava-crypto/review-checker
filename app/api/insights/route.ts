import { buildInsights } from "@/lib/insights";
import { buildRecords } from "@/lib/records-server";
import { sanitizeReviews } from "@/lib/validate";

export async function POST(request: Request) {
  let body: { records?: unknown; settings?: unknown; reviews?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // no body: use the demo records and no reviews
  }
  const { records } = buildRecords(body?.records, body?.settings);
  return Response.json({ ok: true, insights: buildInsights(records, sanitizeReviews(body?.reviews)) });
}
