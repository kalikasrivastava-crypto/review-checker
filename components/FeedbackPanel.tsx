"use client";

import { useState } from "react";
import Stars from "./Stars";
import { useApp, type Feedback } from "./AppProvider";

type Filter = "all" | "low" | "high";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

function Item({ f }: { f: Feedback }) {
  const { setFeedbackStatus } = useApp();
  const low = f.rating <= 3;
  return (
    <li className={`fb-item ${f.status === "new" ? "fb-new" : ""}`}>
      <div className="fb-top">
        <Stars rating={f.rating} />
        {f.verified && <span className="chip chip-verified">✓ Verified visit</span>}
        <span className="fb-when muted small">{when(f.createdAt)}</span>
      </div>
      {f.comment ? <p className="fb-comment">“{f.comment}”</p> : <p className="muted small">No comment left.</p>}
      <dl className="fb-facts">
        {(f.visitDate || f.visitTime) && (
          <div>
            <dt>Visit</dt>
            <dd>{[f.visitDate, f.visitTime].filter(Boolean).join(" at ")}</dd>
          </div>
        )}
        {f.partySize && (
          <div>
            <dt>Party</dt>
            <dd>{f.partySize}</dd>
          </div>
        )}
        {f.billNo && (
          <div>
            <dt>Bill no.</dt>
            <dd>{f.billNo}</dd>
          </div>
        )}
        {f.name && (
          <div>
            <dt>Name</dt>
            <dd>{f.name}</dd>
          </div>
        )}
        {f.phone && (
          <div>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${f.phone.replace(/[^\d+]/g, "")}`}>{f.phone}</a>
            </dd>
          </div>
        )}
      </dl>
      <div className="fb-actions">
        <label className="inline-field">
          Status
          <select value={f.status} onChange={(e) => setFeedbackStatus(f.id, e.target.value as Feedback["status"])}>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        {low && f.status === "new" && <span className="small muted">Low rating: worth a personal reply.</span>}
      </div>
    </li>
  );
}

/** Private feedback guests leave through the QR page. New ones appear here the moment they are sent. */
export default function FeedbackPanel() {
  const { feedback, setTab } = useApp();
  const [filter, setFilter] = useState<Filter>("all");
  const shown = feedback.filter((f) => (filter === "low" ? f.rating <= 3 : filter === "high" ? f.rating >= 4 : true));

  return (
    <div className="stack">
      <section className="panel">
        <h2>Guest feedback</h2>
        <p className="muted small">
          What guests tell you privately through your QR page. Only you can see it. Ratings of 1 to 3 stay here; guests who rate 4 or 5
          are invited to share on Google.
        </p>
        <label className="inline-field">
          Show
          <select value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
            <option value="all">All feedback</option>
            <option value="low">1 to 3 stars (needs a look)</option>
            <option value="high">4 and 5 stars</option>
          </select>
        </label>
      </section>

      {feedback.length === 0 ? (
        <section className="panel empty-state">
          <h2>No guest feedback yet</h2>
          <p className="muted">Print your QR code and put it on tables or bills. New feedback shows up here instantly.</p>
          <div className="actions">
            <button type="button" className="btn btn-solid" onClick={() => setTab("restaurant")}>
              Get my QR code
            </button>
          </div>
        </section>
      ) : shown.length === 0 ? (
        <section className="panel empty-state">
          <p className="muted">Nothing matches that filter.</p>
        </section>
      ) : (
        <ul className="fb-list">
          {shown.map((f) => (
            <Item key={f.id} f={f} />
          ))}
        </ul>
      )}
    </div>
  );
}
