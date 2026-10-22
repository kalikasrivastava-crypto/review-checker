import Link from "next/link";
import { useId } from "react";

// Front speech bubble (with its tail at the bottom left). The lighter bubble behind it is cut around it so the two never blur together.
const FRONT = "M12 13H27A9 9 0 0 1 36 22V28A9 9 0 0 1 27 37H17.5L10.2 43.4A1.1 1.1 0 0 1 8.4 42.4L9.4 36.6A9 9 0 0 1 3 28V22A9 9 0 0 1 12 13Z";

/** The DineTrust mark: two overlapping speech bubbles with a check. Colours follow the site's light and dark themes. */
export function LogoMark({ className }: { className?: string }) {
  const id = `cut-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="48" height="48">
          <rect width="48" height="48" fill="#fff" />
          <path d={FRONT} fill="#000" stroke="#000" strokeWidth="5" strokeLinejoin="round" />
        </mask>
      </defs>
      <rect x="17" y="4" width="28" height="19" rx="8" style={{ fill: "var(--logo-back)" }} mask={`url(#${id})`} />
      <path d={FRONT} style={{ fill: "var(--accent)" }} />
      <path d="M12.8 25.8l4 4L27.3 18.4" fill="none" style={{ stroke: "var(--logo-check)" }} strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The mark with the "DineTrust" wordmark, as a link home. Use iconOnly where space is tight. */
export default function Logo({ href = "/", iconOnly = false }: { href?: string; iconOnly?: boolean }) {
  return (
    <Link href={href} className="logo" aria-label="DineTrust home">
      <LogoMark />
      {!iconOnly && <span className="logo__word">DineTrust</span>}
    </Link>
  );
}
