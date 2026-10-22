import Link from "next/link";

/** The DineTrust mark: a plate with a check, in the brand green. */
export default function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="logo" aria-label="DineTrust home">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="var(--accent)" />
        <circle cx="16" cy="16" r="8.5" fill="none" stroke="var(--accent-ink)" strokeWidth="1.8" />
        <path d="m12.2 16.2 2.6 2.6 5-5.4" fill="none" stroke="var(--accent-ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>DineTrust</span>
    </Link>
  );
}
