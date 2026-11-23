"use client";

import { useState } from "react";
import { IconAlert, IconCheck } from "./UiIcons";

type State = { kind: "idle" } | { kind: "sending" } | { kind: "done"; emailed: boolean } | { kind: "error"; message: string };

/** The home page contact form. It posts to /api/contact, which saves the row and sends the emails. */
export default function ContactForm() {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(30_000),
      });
      const j = (await res.json().catch(() => null)) as { ok?: boolean; error?: string; emailed?: boolean } | null;
      if (j?.ok) {
        form.reset();
        setState({ kind: "done", emailed: !!j.emailed });
      } else setState({ kind: "error", message: j?.error ?? "Something went wrong. Please try again." });
    } catch {
      setState({ kind: "error", message: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  if (state.kind === "done") {
    return (
      <div className="alert alert--success" role="status">
        <IconCheck />
        <p>
          <strong>Thanks, your message was sent.</strong>{" "}
          {state.emailed ? "We've emailed you a confirmation, so check your inbox." : "We saved it, but couldn't send a confirmation email this time."}
        </p>
      </div>
    );
  }

  const sending = state.kind === "sending";
  return (
    <form onSubmit={onSubmit} className="contact-form" noValidate>
      {state.kind === "error" && (
        <div className="alert alert--error" role="alert">
          <IconAlert />
          <p>{state.message}</p>
        </div>
      )}
      <label>
        Your name
        <input name="name" type="text" autoComplete="name" required maxLength={100} disabled={sending} />
      </label>
      <label>
        Your email
        <input name="email" type="email" autoComplete="email" required maxLength={254} disabled={sending} />
      </label>
      <label>
        Your question
        <textarea name="message" rows={5} required maxLength={2000} disabled={sending} />
      </label>
      {/* Hidden from people. Bots fill it in, and the server then ignores the message. */}
      <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
        <label>
          Leave this empty
          <input name="website" type="text" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div>
        <button type="submit" className="button button--primary" disabled={sending}>
          {sending ? "Sending…" : "Send message"}
        </button>
      </div>
    </form>
  );
}
