"use client";

import RecordsBox from "./RecordsBox";
import type { Mode } from "./AppProvider";
import type { CustomRecords } from "@/lib/records";

interface Props {
  custom: CustomRecords | null;
  mode: Mode | null;
  demoCounts: { bills: number; reservations: number };
  onChange: (next: CustomRecords | null) => void;
}

export default function RecordsPanel({ custom, mode, demoCounts, onChange }: Props) {
  return (
    <div className="stack">
      <section className="panel">
        <h2>Your records</h2>
        {custom ? (
          <>
            <p>
              Using <strong>your uploaded records</strong>. Anything you haven&apos;t uploaded counts as &ldquo;no
              record&rdquo;, so a missing file never counts against a review.
            </p>
            <div className="actions">
              <button type="button" className="btn" onClick={() => onChange(null)}>
                {mode === "demo" ? "Switch back to the sample records" : "Remove my uploaded records"}
              </button>
            </div>
          </>
        ) : mode === "demo" ? (
          <p>
            Using the <strong>sample records</strong>: {demoCounts.bills} bills and {demoCounts.reservations} reservations
            from 13–18 October 2026, plus the opening hours and table limit. Upload your own below to check reviews
            against real records.
          </p>
        ) : (
          <p>
            No bills or reservations uploaded yet. That&apos;s fine: DineTrust still checks your opening hours and
            table limits, and marks anything else &ldquo;can&apos;t verify&rdquo;.
          </p>
        )}
        <p className="muted">
          Your files are read in your browser and kept on this device. They are sent to this app&apos;s server to check
          a review, but never to the AI.
        </p>
      </section>

      <RecordsBox kind="bills" custom={custom} onChange={onChange} />
      <RecordsBox kind="reservations" custom={custom} onChange={onChange} />
    </div>
  );
}
