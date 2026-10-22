"use client";

import { useApp } from "./AppProvider";

/** The DineTrust title, the owner's restaurant name, "?" for help and a log out button. */
export default function Masthead({ subtitle }: { subtitle: string }) {
  const { setHelpOpen, restaurant, signOut, isDemo } = useApp();
  return (
    <header className="masthead">
      <div className="masthead-row">
        <h1>DineTrust</h1>
        <div className="masthead-tools">
          <button type="button" className="help-button" onClick={() => setHelpOpen(true)} aria-label="Help: tour, CSV templates and questions" title="Help">
            ?
          </button>
          <button type="button" className="btn btn-small logout" onClick={() => void signOut()}>
            Log out
          </button>
        </div>
      </div>
      <p className="owner-line">
        <span className="owner-pill">Owner area</span>
        {restaurant && (
          <strong className="owner-name">
            {restaurant.name}
            {isDemo ? " (demo)" : ""}
          </strong>
        )}
      </p>
      <p>{subtitle}</p>
    </header>
  );
}
