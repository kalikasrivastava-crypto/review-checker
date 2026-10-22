"use client";

import { useState } from "react";
import CopyButton from "./CopyButton";

export default function RemovalReport({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);

  return (
    <section className="panel fade-in">
      <h2>Report to Google</h2>
      <p className="muted">
        This review looks suspicious. Paste this summary into Google&apos;s &ldquo;Report review&rdquo; form. It is
        built from your records, not proof the review is fake, so edit it and check it before you send it.
      </p>
      <label className="sr-only" htmlFor="removal-report">
        Removal report
      </label>
      <textarea id="removal-report" value={text} rows={9} onChange={(e) => setText(e.target.value)} />
      <div className="actions">
        <CopyButton text={text} label="Copy report" />
      </div>
    </section>
  );
}
