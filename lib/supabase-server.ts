import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Order, Records, Reservation } from "./records";
import { DEMO_SETTINGS, normalizeSettings, sanitizeSettings, toHours, type RestaurantSettings } from "./settings";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** A client that acts as the signed-in owner (from the request's Authorization header), so Row Level Security applies. */
export function userClient(request: Request): SupabaseClient | null {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!URL || !PUBLISHABLE || !token) return null;
  return createClient(URL, PUBLISHABLE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Like userClient, but only when the login token is real and still valid; otherwise null (answer 401). */
export async function signedInClient(request: Request): Promise<SupabaseClient | null> {
  const sb = userClient(request);
  if (!sb) return null;
  const { data, error } = await sb.auth.getUser();
  return error || !data.user ? null : sb;
}

/** The all-powerful client. Server only, and only for jobs a signed-in owner can't do (like making a demo account). */
export function adminClient(): SupabaseClient | null {
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!URL || !key) return null;
  return createClient(URL, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/** Reads every row (the database returns at most 1000 at a time). */
async function fetchAll<T>(page: (from: number, to: number) => Page<T>, max = 15000): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const { data, error } = await page(from, from + 999);
    if (error || !data) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

export interface RestaurantRow {
  id: string;
  settings: RestaurantSettings;
  records_version: number;
}

/** The records a check compares against, read from the database, plus the settings it applies. */
export async function loadRecords(sb: SupabaseClient, restaurant: RestaurantRow): Promise<{ records: Records; settings: RestaurantSettings }> {
  const bills = await fetchAll<{ bill_no: string; date: string; minutes: number; party_size: number; items: string }>((from, to) =>
    sb.from("bills").select("bill_no,date,minutes,party_size,items").eq("restaurant_id", restaurant.id).order("id").range(from, to),
  );
  const reservations = await fetchAll<{ ref: string; date: string; minutes: number; party_size: number }>((from, to) =>
    sb.from("reservations").select("ref,date,minutes,party_size").eq("restaurant_id", restaurant.id).order("id").range(from, to),
  );
  const settings = sanitizeSettings(restaurant.settings) ?? normalizeSettings(DEMO_SETTINGS);
  const orders: Order[] = bills.map((b) => ({ billId: b.bill_no, date: b.date, minutes: b.minutes, partySize: b.party_size, items: b.items }));
  const resv: Reservation[] = reservations.map((r) => ({ ref: r.ref, date: r.date, minutes: r.minutes, partySize: r.party_size }));
  return { records: { orders, reservations: resv, hours: toHours(settings) }, settings };
}
