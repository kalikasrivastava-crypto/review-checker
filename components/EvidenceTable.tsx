import type { Evidence, Status } from "@/lib/types";

const LABEL: Record<Status, string> = {
  match: "Match",
  mismatch: "Mismatch",
  no_data: "No data",
};

export default function EvidenceTable({ evidence }: { evidence: Evidence[] }) {
  return (
    <section className="card">
      <h2>Claims checked against your records</h2>
      {evidence.length === 0 ? (
        <p className="muted">The review makes no factual claims that can be checked.</p>
      ) : (
        <table className="evidence">
          <thead>
            <tr>
              <th>Claim</th>
              <th>Result</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((e, i) => (
              <tr key={i}>
                <td>&ldquo;{e.claim}&rdquo;</td>
                <td>
                  <span className={`badge badge-${e.status}`}>{LABEL[e.status]}</span>
                </td>
                <td>{e.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
