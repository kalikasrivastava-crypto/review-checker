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
    </section>
  );
}
