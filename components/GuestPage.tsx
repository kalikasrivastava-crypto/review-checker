"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

interface PublicRestaurant {
  name: string;
  google_review_url: string;
}

const LABELS = ["Poor", "Not great", "Okay", "Good", "Excellent"];

const pad = (n: number) => String(n).padStart(2, "0");

/** The page a guest opens from the QR code. No login, and it only ever learns the restaurant's name and Google link. */
export default function GuestPage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<"loading" | "missing" | "ready">("loading");
  const [restaurant, setRestaurant] = useState<PublicRestaurant | null>(null);

  useEffect(() => {
    let cancelled = false;
    void supabase()
      .rpc("public_restaurant", { p_slug: String(slug) })
      .then(({ data }) => {
        if (cancelled) return;
        const row = Array.isArray(data) ? (data[0] as PublicRestaurant | undefined) : undefined;
        if (row) {
          setRestaurant(row);
          setState("ready");
        } else setState("missing");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="guest">
      <main className="guest-shell">
        {state === "loading" && <p className="guest-muted">One moment…</p>}
        {state === "missing" && (
          <section className="guest-card">
            <h1>We couldn&apos;t find that page</h1>
            <p className="guest-muted">The QR code may be out of date. Please ask the restaurant for a new one.</p>
          </section>
        )}
        {state === "ready" && restaurant && <FeedbackForm slug={String(slug)} restaurant={restaurant} />}
        <p className="guest-foot">Powered by DineTrust</p>
      </main>
    </div>
  );
}

function FeedbackForm({ slug, restaurant }: { slug: string; restaurant: PublicRestaurant }) {
  // These start from the current time, which is fine here: the form only exists in the browser.
  const [rating, setRating] = useState(0);
  const [visitDate, setVisitDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const [visitTime, setVisitTime] = useState(() => {
    const d = new Date();
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });
  const [party, setParty] = useState("");
  const [bill, setBill] = useState("");
  const [comment, setComment] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [trap, setTrap] = useState(""); // a hidden field only bots fill in
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ rating: number; verified: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (rating < 1) return setError("Please tap the stars to rate your visit.");
    if (trap) return setDone({ rating, verified: false });
    setBusy(true);
    const { data, error: err } = await supabase().rpc("submit_feedback", {
      p_slug: slug,
      p_rating: rating,
      p_visit_date: visitDate || null,
      p_visit_time: visitTime || null,
      p_party_size: party ? Number(party) : null,
      p_bill_no: bill || null,
      p_comment: comment || null,
      p_name: name || null,
      p_phone: phone || null,
    });
    setBusy(false);
    const res = data as { ok?: boolean; verified?: boolean; error?: string } | null;
    if (err || !res?.ok) {
      setError(res?.error === "busy" ? "The restaurant is getting lots of feedback right now. Please try again in a few minutes." : "Sorry, that didn't go through. Please try again.");
      return;
    }
    setDone({ rating, verified: !!res.verified });
  }

  if (done) {
    const happy = done.rating >= 4;
    const google = restaurant.google_review_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.name)}`;
    return (
      <section className="guest-card guest-thanks">
        <div className="guest-check" aria-hidden="true">
          ✓
        </div>
        <h1>{happy ? "Thank you!" : "Thanks for telling us"}</h1>
        {done.verified && <p className="guest-verified">✓ Verified visit</p>}
        {happy ? (
          <>
            <p className="guest-muted">We&apos;re so glad you enjoyed {restaurant.name}. Would you share it on Google? It really helps a small restaurant.</p>
            <a className="guest-btn" href={google} target="_blank" rel="noopener noreferrer">
              Share on Google
            </a>
          </>
        ) : (
          <p className="guest-muted">Thanks, the manager will contact you. We&apos;re sorry your visit wasn&apos;t better, and we want to put it right.</p>
        )}
      </section>
    );
  }

  return (
    <form className="guest-card" onSubmit={submit} noValidate>
      <p className="guest-kicker">{restaurant.name}</p>
      <h1>How was your visit?</h1>

      <fieldset className="guest-stars">
        <legend className="sr-only">Your rating</legend>
        <div className="guest-star-row" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n === 1 ? "" : "s"}, ${LABELS[n - 1]}`}
              className={`guest-star ${n <= rating ? "on" : ""}`}
              onClick={() => setRating(n)}
            >
              ★
            </button>
          ))}
        </div>
        <p className="guest-star-label" aria-live="polite">
          {rating ? LABELS[rating - 1] : "Tap a star"}
        </p>
      </fieldset>

      <div className="guest-two">
        <label className="field">
          Date of your visit
          <input type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
        </label>
        <label className="field">
          Time
          <input type="time" value={visitTime} onChange={(e) => setVisitTime(e.target.value)} />
        </label>
      </div>
      <div className="guest-two">
        <label className="field">
          How many people?
          <input type="number" min={1} max={200} inputMode="numeric" value={party} placeholder="e.g. 4" onChange={(e) => setParty(e.target.value)} />
        </label>
        <label className="field">
          Bill number (optional)
          <input type="text" value={bill} placeholder="e.g. B-1001" onChange={(e) => setBill(e.target.value)} />
        </label>
      </div>
      <p className="guest-hint">Your bill number is printed on your receipt. It lets us confirm your visit.</p>

      <label className="field">
        Tell us more
        <textarea rows={4} value={comment} maxLength={2000} placeholder="What went well? What could we do better?" onChange={(e) => setComment(e.target.value)} />
      </label>

      <div className="guest-two">
        <label className="field">
          Your name (optional)
          <input type="text" value={name} placeholder="e.g. Asha" autoComplete="given-name" onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          Phone (optional)
          <input type="tel" value={phone} placeholder="e.g. 98765 43210" autoComplete="tel" onChange={(e) => setPhone(e.target.value)} />
        </label>
      </div>
      <p className="guest-hint">Only the restaurant sees your name and phone, so the manager can get back to you.</p>

      <div className="guest-trap" aria-hidden="true">
        <label>
          Leave this empty
          <input type="text" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </label>
      </div>

      {error && (
        <p className="guest-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="guest-btn" disabled={busy}>
        {busy ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
