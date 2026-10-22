/** The risk score out of 100 as a ring. Higher means riskier. */
export default function RiskRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(100, score)) / 100;
  return (
    <figure className="ring" aria-label={`Risk score ${score} out of 100`}>
      <svg viewBox="0 0 128 128" role="img" aria-hidden="true">
        <circle cx="64" cy="64" r={r} className="ring-track" fill="none" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={r}
          className="ring-value"
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filled * c} ${c}`}
          transform="rotate(-90 64 64)"
        />
      </svg>
      <figcaption className="ring-center">
        <span className="ring-number">{score}</span>
        <span className="ring-of">out of 100</span>
      </figcaption>
    </figure>
  );
}
