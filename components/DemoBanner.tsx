"use client";

import { useApp } from "./AppProvider";

/** Shown on every page of the owner's area while the demo restaurant is open. */
export default function DemoBanner() {
  const { setAuthMode, signOut } = useApp();
  return (
    <div className="demo-banner" role="status">
      <span>You&apos;re viewing sample data.</span>{" "}
      <button
        type="button"
        className="link-button"
        onClick={async () => {
          setAuthMode("signup");
          await signOut();
        }}
      >
        Set up your restaurant →
      </button>
    </div>
  );
}
