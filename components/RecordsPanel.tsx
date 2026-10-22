"use client";

import { useState } from "react";
import RecordsBox from "./RecordsBox";
import { useApp } from "./AppProvider";

export default function RecordsPanel() {
  const { recordCounts, restaurant, saveRecords, clearRecords, toast, isDemo } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);
  const any = recordCounts.bills + recordCounts.reservations > 0;

  return (
    <div className="stack">
      <section className="panel">
        <h2>Your records</h2>
        {any ? (
          <p>
            Saved in your database: <strong>{recordCounts.bills.toLocaleString()}</strong> bills and{" "}
            <strong>{recordCounts.reservations.toLocaleString()}</strong> reservations
            {isDemo ? " (the sample set, 13–18 October 2026)" : ""}. Anything you haven&apos;t uploaded counts as &ldquo;no record&rdquo;, so a
            missing file never counts against a review.
          </p>
        ) : (
          <p>
            No bills or reservations uploaded yet. That&apos;s fine: DineTrust still checks your opening hours and table limits, and marks
            anything else &ldquo;can&apos;t verify&rdquo;.
          </p>
        )}
        {any && (
          <div className="actions">
            {confirmClear ? (
              <>
                <button
                  type="button"
                  className="btn btn-small btn-danger"
                  onClick={async () => {
                    setConfirmClear(false);
                    await clearRecords();
                    toast("Your uploaded records were removed", "success");
                  }}
                >
                  Yes, remove all records
                </button>
                <button type="button" className="btn btn-small" onClick={() => setConfirmClear(false)}>
                  Cancel
                </button>
              </>
            ) : (
              <button type="button" className="btn" onClick={() => setConfirmClear(true)}>
                Remove all records
              </button>
            )}
          </div>
        )}
        <p className="muted">
          Your files are saved privately in your restaurant&apos;s database, visible only to you. They are used on the server to check a
          review, but never sent to the AI.
        </p>
      </section>

      <RecordsBox
        kind="bills"
        count={recordCounts.bills}
        fileName={restaurant?.billsFile ?? ""}
        onUse={async (name, records) => {
          const ok = await saveRecords({ orders: records as never, ordersName: name });
          toast(ok ? "Bills saved" : "Couldn't save the bills. Try again.", ok ? "success" : "error");
        }}
      />
      <RecordsBox
        kind="reservations"
        count={recordCounts.reservations}
        fileName={restaurant?.reservationsFile ?? ""}
        onUse={async (name, records) => {
          const ok = await saveRecords({ reservations: records as never, reservationsName: name });
          toast(ok ? "Reservations saved" : "Couldn't save the reservations. Try again.", ok ? "success" : "error");
        }}
      />
    </div>
  );
}
