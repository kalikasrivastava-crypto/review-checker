import { buildInsights } from "@/lib/insights";
import { loadRecords, userClient, type RestaurantRow } from "@/lib/supabase-server";

/** Dashboard numbers, footfall, themes and look-alike reviews for the signed-in owner's restaurant (no AI). */
export async function POST(request: Request) {
  const sb = userClient(request);
  if (!sb) return Response.json({ ok: false, error: "Please log in again." }, { status: 401 });
  const { data: restaurant } = await sb.from("restaurants").select("id,settings,records_version").limit(1).maybeSingle();
  if (!restaurant) return Response.json({ ok: false, error: "No restaurant yet." }, { status: 404 });
  const { records } = await loadRecords(sb, restaurant as RestaurantRow);
  const { data } = await sb.from("reviews").select("id,author,rating,date,text").eq("restaurant_id", restaurant.id).limit(400);
  const reviews = (data ?? []).map((o) => ({ id: o.id as string, author: o.author as string, rating: Number(o.rating), date: o.date as string, text: o.text as string }));
  return Response.json({ ok: true, insights: buildInsights(records, reviews) });
}
