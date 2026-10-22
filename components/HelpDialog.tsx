"use client";

import DataNeeds from "./DataNeeds";
import Modal from "./Modal";
import { useApp } from "./AppProvider";

const FAQ = [
  {
    q: "What data do I need?",
    a: "Your opening hours and tables are enough to start. Bills and reservations (CSV files) make the checks sharper. Anything DineTrust can't check is marked \"can't verify\" and never counted against a review.",
  },
  {
    q: "Is my data private?",
    a: "Your details and files are kept in this browser. Bills and reservations are sent to this app's server only to compare them with a review, and are never sent to the AI. The AI reads just the review text, to pull out what it claims.",
  },
  {
    q: "Does this prove a review is fake?",
    a: "No. It shows whether a review's claims conflict with your records. A conflict is a reason to look closer, not proof: guests can misremember, pay on someone else's bill or review the wrong place. You decide what to do.",
  },
  {
    q: "Why does it say \"can't verify\"?",
    a: "Opinions like rude staff or cold food are not in your records, and some days may have no records at all. Those claims are shown as can't verify and don't raise the risk.",
  },
  {
    q: "Why is the AI busy?",
    a: "DineTrust uses a free AI plan that allows only a few requests a minute. It waits and retries by itself. The sample reviews and the example review don't use the AI, so they always open instantly.",
  },
];

export default function HelpDialog() {
  const { setHelpOpen, startTour, setTab, setSelectedId, reviews, entries, selectedId, toast } = useApp();
  const close = () => setHelpOpen(false);

  function replay() {
    const shown = selectedId && entries[selectedId]?.result ? selectedId : reviews.find((r) => entries[r.id]?.result)?.id;
    if (!shown) {
      toast("Check a review first, then replay the tour on its case report.", "info");
      return;
    }
    setSelectedId(shown);
    setTab("inbox");
    close();
    startTour();
  }

  return (
    <Modal title="Help" onClose={close}>
      <section className="help-block">
        <h3>Quick tour</h3>
        <p className="muted small">Four short pointers on a case report: the risk level, conflicts, missing data and what to do next.</p>
        <button type="button" className="btn btn-small" onClick={replay}>
          Replay the tour
        </button>
      </section>

      <section className="help-block">
        <h3>CSV templates</h3>
        <p className="muted small">Fill these in with your own bills and bookings, then upload them on the Records page.</p>
        <div className="actions">
          <a className="btn btn-small" href="/dinetrust-bills-template.csv" download>
            Bills template
          </a>
          <a className="btn btn-small" href="/dinetrust-reservations-template.csv" download>
            Reservations template
          </a>
        </div>
      </section>

      <section className="help-block">
        <h3>What data do I need?</h3>
        <DataNeeds />
      </section>

      <section className="help-block">
        <h3>Questions</h3>
        {FAQ.map((f) => (
          <details key={f.q} className="faq">
            <summary>{f.q}</summary>
            <p>{f.a}</p>
          </details>
        ))}
      </section>
    </Modal>
  );
}
