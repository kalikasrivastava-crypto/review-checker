import { buildInsights } from "@/lib/insights";
import { loadDefaultRecords } from "@/lib/records-default";
import { sanitizeUploaded } from "@/lib/records";
import { sanitizeReviews } from "@/lib/validate";

export async function POST(request: Request) {
  let body: { records?: unknown; reviews?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    // no body: use the demo records and no reviews
  }
  const base = loadDefaultRecords();
  const custom = sanitizeUploaded(body?.records);
  const records = custom ? { ...base, orders: custom.orders, reservations: custom.reservations } : base;
  return Response.json({ ok: true, insights: buildInsights(records, sanitizeReviews(body?.reviews)) });
}
