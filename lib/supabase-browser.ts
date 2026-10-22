"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | undefined;

/** The browser's Supabase client. It uses only the publishable key; Row Level Security protects the data. */
export function supabase(): SupabaseClient {
  if (!client) {
    client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "", {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    });
  }
  return client;
}

export const supabaseConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

/** POSTs JSON to one of our API routes as the signed-in owner. */
export async function authedPost(path: string, body: unknown): Promise<Response> {
  const { data } = await supabase().auth.getSession();
  return fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(body),
  });
}

/** Starts a private copy of the Demo Restaurant for this visitor. Returns an error message, or null when it worked. */
export async function startDemoSession(): Promise<string | null> {
  try {
    const res = await fetch("/api/demo", { method: "POST" });
    const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; email?: string; password?: string } | null;
    if (!j?.ok || !j.email || !j.password) return j?.error ?? "Couldn't start the demo. Try again.";
    try {
      localStorage.setItem("dt-start-demo", "1");
    } catch {
      // without storage the demo still opens, just without the guided tour
    }
    const { error } = await supabase().auth.signInWithPassword({ email: j.email, password: j.password });
    return error ? "Couldn't start the demo. Try again." : null;
  } catch {
    return "The connection failed. Try again.";
  }
}
