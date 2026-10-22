"use client";

import { useApp } from "./AppProvider";

/** Shown on every page while the sample restaurant is loaded. */
export default function DemoBanner() {
  const { startSetup } = useApp();
  return (
    <div className="demo-banner" role="status">
      <span>You&apos;re viewing sample data.</span>{" "}
      <button type="button" className="link-button" onClick={startSetup}>
        Set up your restaurant →
      </button>
    </div>
  );
}
