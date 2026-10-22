"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";

export default function RemovalReport({
  initial,
  reported,
  onMarkReported,
  onPdf,
}: {
  initial: string;
  reported?: boolean;
  onMarkReported?: () => void;
  onPdf?: () => void;
}) {
  const [text, setText] = useState(initial);

  return (
    <section className="panel fade-in">
      <h2>Report to Google</h2>
      <p className="muted">
        This review looks suspicious. Paste this summary into Google&apos;s &ldquo;Report review&rdquo; form. It is
        built from your records. It only lists where the review conflicts with them, which is not proof of anything, so edit it and check it before you send it.
      </p>
      <label className="sr-only" htmlFor="removal-report">
        Removal report
      </label>
      <textarea id="removal-report" value={text} rows={9} placeholder="The text to send to Google will appear here." onChange={(e) => setText(e.target.value)} />
      <div className="actions">
        {onPdf && (
          <button type="button" className="btn btn-solid" onClick={onPdf}>
            Download PDF report
          </button>
        )}
        <CopyButton text={text} label="Copy report" />
        {onMarkReported && (
          <button type="button" className="btn" onClick={onMarkReported} disabled={reported}>
            {reported ? "Marked as reported" : "Mark as reported"}
          </button>
        )}
      </div>
    </section>
  );
}
