import { randomBytes, randomUUID } from "node:crypto";
import { adminClient } from "@/lib/supabase-server";

// A visitor can start a few demos an hour from one address.
const hits = new Map<string, number[]>();
const LIMIT = 8;

/**
 * "Try demo": makes a throwaway account, so every visitor gets a private copy of the Demo Restaurant
 * and nobody sees anyone else's changes. Needs the server-only secret key.
 */
export async function POST(request: Request) {
  const admin = adminClient();
  if (!admin) {
    return Response.json({ ok: false, error: "The demo isn't available on this server yet." }, { status: 503 });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= LIMIT) {
    return Response.json({ ok: false, error: "Too many demos from this connection. Try again in an hour." }, { status: 429 });
  }
  hits.set(ip, [...recent, now]);

  const email = `demo-${randomUUID()}@example.com`;
  const password = randomBytes(18).toString("base64url");
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { demo: true } });
  if (error) return Response.json({ ok: false, error: "Couldn't start the demo. Try again." }, { status: 502 });
  return Response.json({ ok: true, email, password });
}
