"use client";

import { useApp } from "./AppProvider";

/** The DineTrust title with a small "?" that opens help. */
export default function Masthead({ subtitle }: { subtitle: string }) {
  const { setHelpOpen } = useApp();
  return (
    <header className="masthead">
      <div className="masthead-row">
        <h1>DineTrust</h1>
        <button type="button" className="help-button" onClick={() => setHelpOpen(true)} aria-label="Help: tour, CSV templates and questions" title="Help">
          ?
        </button>
      </div>
      <p>{subtitle}</p>
    </header>
  );
}
