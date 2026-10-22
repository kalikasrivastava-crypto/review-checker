import type { CheckResult } from "@/lib/types";

export default function ScoreCard({ result }: { result: CheckResult }) {
  const raised = result.risk !== result.aiRisk;
  return (
    <section className="card">
      <h2>
        Risk: <span className={`risk risk-${result.risk}`}>{result.risk.toUpperCase()}</span>
      </h2>
      {raised && (
        <p className="muted">
          The AI rated this {result.aiRisk}; your records and recent reviews raised it to {result.risk}.
        </p>
      )}
      <ul className="reasons">
        {result.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  );
}
