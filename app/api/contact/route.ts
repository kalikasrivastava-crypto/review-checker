import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { acknowledgementMail, checkContact, ownerMail } from "@/lib/contact";

export const maxDuration = 30;

// A visitor address can send a few messages an hour. Each one triggers an automatic email, so this limits misuse.
// It is counted per server instance, so it is a safety net rather than a hard limit.
const hits = new Map<string, number[]>();
const LIMIT = 5;

const reply = (body: Record<string, unknown>, status = 200) => Response.json(body, { status });

/**
 * Contact form. 1) Check the fields. 2) Save a new row in Supabase (Row Level Security: visitors can only insert).
 * 3) Email the site owner, and send the visitor an automatic reply. The row is saved first, so a message is never
 * lost if email is down; the answer says clearly what did and did not happen.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return reply({ ok: false, error: "That didn't look right. Please try again." }, 400);
  }
  // A hidden field real visitors never fill in. Bots do. Pretend it worked.
  if (typeof (body as { website?: unknown })?.website === "string" && (body as { website: string }).website.trim() !== "") return reply({ ok: true, saved: true, emailed: false });

  const checked = checkContact(body);
  if (!checked.ok) return reply({ ok: false, error: checked.error }, 400);

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= LIMIT) return reply({ ok: false, error: "Too many messages from this connection. Please try again in an hour." }, 429);
  hits.set(ip, [...recent, now]);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return reply({ ok: false, error: "The contact form isn't available right now. Please try again later." }, 503);

  // No .select(): the table is insert-only, so the row can't be read back.
  const { error } = await createClient(url, key, { auth: { persistSession: false } }).from("contact_messages").insert(checked.value);
  if (error) {
    console.error("Contact form: saving failed:", error.code ?? "", error.message);
    return reply({ ok: false, error: "We couldn't save your message. Please try again in a moment." }, 502);
  }

  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");
  const owner = process.env.OWNER_EMAIL?.trim() || user;
  if (!user || !pass || !owner) {
    console.error("Contact form: email isn't set up (GMAIL_USER, GMAIL_APP_PASSWORD, OWNER_EMAIL)");
    return reply({ ok: true, saved: true, emailed: false });
  }
  try {
    const transport = nodemailer.createTransport({ service: "gmail", auth: { user, pass }, connectionTimeout: 10_000, socketTimeout: 15_000 });
    const from = `DineTrust <${user}>`;
    await Promise.all([transport.sendMail({ from, ...ownerMail(checked.value, owner) }), transport.sendMail({ from, ...acknowledgementMail(checked.value) })]);
    return reply({ ok: true, saved: true, emailed: true });
  } catch (err) {
    console.error("Contact form: email failed:", err instanceof Error ? err.message : err);
    return reply({ ok: true, saved: true, emailed: false });
  }
}
