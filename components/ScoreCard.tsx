import type { CheckResult } from "@/lib/types";

export default function ScoreCard({ result }: { result: CheckResult }) {
  return (
    <section className={`panel verdict-panel verdict-${result.verdict.toLowerCase()} fade-in`} aria-live="polite">
      <div className="verdict-row">
        <span className="stamp">{result.verdict}</span>
        <div className="confidence">
          Confidence {result.confidence}%
          <div
            className="confidence-bar"
            role="progressbar"
            aria-label="Confidence"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={result.confidence}
          >
            <span style={{ width: `${result.confidence}%` }} />
          </div>
        </div>
      </div>
      <p className="summary">{result.summary}</p>

      <h3 className="factors-title">Why this score</h3>
      {result.breakdown === undefined ? (
        <p className="muted small">This result was saved before score breakdowns existed. Re-check it to see one.</p>
      ) : result.breakdown.length === 0 ? (
        <p className="muted small">Nothing in this review raised suspicion.</p>
      ) : (
        <ul className="factors">
          {result.breakdown.map((f, i) => (
            <li key={i}>
              <span>{f.label}</span>
              <span className={f.points > 0 ? "pts pts-up" : "pts pts-down"}>
                {f.points > 0 ? "+" : "−"}
                {Math.abs(f.points)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {result.score !== undefined && (
        <p className="factor-total">
          Suspicion score <strong>{result.score}</strong> / 100. From 40 up, a review is called Suspicious.
        </p>
      )}
    </section>
  );
}
