import type { Check, Status } from "@/lib/types";

const LABEL: Record<Status, string> = {
  match: "Match",
  mismatch: "Mismatch",
  no_record: "No record",
};

function StatusIcon({ status }: { status: Status }) {
  return (
    <svg viewBox="0 0 24 24" className={`status-icon status-${status}`} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" />
      {status === "match" && (
        <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      )}
      {status === "mismatch" && (
        <path d="M8.5 8.5l7 7M15.5 8.5l-7 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      )}
      {status === "no_record" && (
        <path d="M8 12h8" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      )}
    </svg>
  );
}

export default function EvidenceTable({ checks }: { checks: Check[] }) {
  return (
    <section className="panel fade-in">
      <h2>Claim vs. record</h2>
      {checks.length === 0 ? (
        <p className="muted">This review makes no factual claims that can be checked.</p>
      ) : (
        <ul className="evidence">
          {checks.map((c, i) => (
            <li key={i}>
              <StatusIcon status={c.status} />
              <div>
                <p className="evidence-claim">&ldquo;{c.claim}&rdquo;</p>
                <p className="evidence-record">
                  <span className={`evidence-label status-${c.status}`}>{LABEL[c.status]}.</span> {c.record}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
