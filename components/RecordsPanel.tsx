"use client";

import UploadStep from "./UploadStep";
import type { CustomRecords, Order, Reservation } from "@/lib/records";

interface Props {
  custom: CustomRecords | null;
  demoCounts: { bills: number; reservations: number };
  onChange: (next: CustomRecords | null) => void;
}

const EMPTY: CustomRecords = { orders: null, ordersName: "", reservations: null, reservationsName: "" };

export default function RecordsPanel({ custom, demoCounts, onChange }: Props) {
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
            <ul className="preview-list">
              <li>
                Bills: {custom.orders ? `${custom.orders.length.toLocaleString()} rows from ${custom.ordersName}` : "none uploaded"}
              </li>
              <li>
                Reservations:{" "}
                {custom.reservations
                  ? `${custom.reservations.length.toLocaleString()} rows from ${custom.reservationsName}`
                  : "none uploaded"}
              </li>
            </ul>
            <div className="actions">
              <button type="button" className="btn" onClick={() => onChange(null)}>
                Switch back to the demo dataset
              </button>
            </div>
          </>
        ) : (
          <p>
            Using the <strong>demo dataset</strong>: {demoCounts.bills} bills and {demoCounts.reservations} reservations
            from 13–18 October 2026, plus the opening hours and table limit. Upload your own below to check reviews
            against real records.
          </p>
        )}
        <p className="muted">
          Your files are read in your browser and kept on this device. They are sent to this app&apos;s server to check
          a review, but never to the AI.
        </p>
      </section>

      <section className="panel">
        <h2>Upload bills</h2>
        <p className="muted">
          One row per bill with a date, a time and a party size. A bill number and the items ordered make the checks
          sharper.{" "}
          <a href="/sample-bills.csv" download>
            Download a sample bills CSV
          </a>
        </p>
        <UploadStep
          kind="bills"
          onUse={(name, records) =>
            onChange({ ...(custom ?? EMPTY), orders: records as Order[], ordersName: name })
          }
        />
      </section>

      <section className="panel">
        <h2>Upload reservations</h2>
        <p className="muted">
          One row per booking with a date, a time and a party size.{" "}
          <a href="/sample-reservations.csv" download>
            Download a sample reservations CSV
          </a>
        </p>
        <UploadStep
          kind="reservations"
          onUse={(name, records) =>
            onChange({ ...(custom ?? EMPTY), reservations: records as Reservation[], reservationsName: name })
          }
        />
      </section>
    </div>
  );
}
