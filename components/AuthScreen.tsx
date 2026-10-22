"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "./AppProvider";
import { startDemoSession } from "@/lib/supabase-browser";

/** Log in or sign up (email and password), or open the demo without an account. */
export default function AuthScreen() {
  const { authMode, setAuthMode, signIn, signUp } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const signup = authMode === "signup";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("That email address doesn't look right.");
    if (password.length < 8) return setError("Choose a password with at least 8 characters.");
    setBusy(true);
    if (signup) {
      const res = await signUp(email, password);
      if (res.error) setError(res.error);
      else if (res.needsConfirm) {
        setNotice("Almost there. We sent a link to your email. Open it, then come back here and log in.");
        setAuthMode("login");
      }
    } else {
      const err = await signIn(email, password);
      if (err) setError(err);
    }
    setBusy(false);
  }

  async function demo() {
    setError(null);
    setBusy(true);
    const err = await startDemoSession();
    if (err) {
      setError(err);
      setBusy(false);
    }
  }

  return (
    <div className="shell narrow-shell">
      <header className="masthead">
        <div className="masthead-row">
          <h1>
            <Link href="/" className="masthead-title">
              DineTrust
            </Link>
          </h1>
          <span className="owner-pill">Restaurant owners</span>
        </div>
        <p>Check a bad Google review against your own records, then reply calmly.</p>
      </header>

      <form className="panel auth-card" onSubmit={submit}>
        <h2>{signup ? "Create your account" : "Log in"}</h2>
        <label className="field">
          Email
          <input type="email" value={email} placeholder="e.g. owner@spicegarden.in" autoComplete="email" onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">
          Password
          <input
            type="password"
            value={password}
            placeholder={signup ? "At least 8 characters" : "Your password"}
            autoComplete={signup ? "new-password" : "current-password"}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error && (
          <p className="notice notice-error" role="alert">
            {error}
          </p>
        )}
        {notice && <p className="notice notice-success">{notice}</p>}
        <button type="submit" className="btn btn-solid" disabled={busy}>
          {busy ? "One moment…" : signup ? "Sign up" : "Log in"}
        </button>
        <p className="small muted">
          {signup ? "Already have an account? " : "New here? "}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setAuthMode(signup ? "login" : "signup");
              setError(null);
              setNotice(null);
            }}
          >
            {signup ? "Log in" : "Create an account"}
          </button>
        </p>
      </form>

      <section className="panel auth-demo">
        <h2>Just looking?</h2>
        <p className="muted small">Open a demo restaurant with sample bills, reservations and reviews. No sign-up, and nothing you do is shared.</p>
        <button type="button" className="btn btn-primary" onClick={demo} disabled={busy}>
          Try demo
        </button>
      </section>
    </div>
  );
}
