/** Suspicious vs genuine as a donut, drawn with plain SVG. */
export default function SplitChart({ suspicious, genuine }: { suspicious: number; genuine: number }) {
  const total = suspicious + genuine;
  const r = 42;
  const c = 2 * Math.PI * r;
  const share = total ? suspicious / total : 0;

  return (
    <figure className="chart split">
      <svg viewBox="0 0 120 120" role="img" aria-label={`${suspicious} suspicious and ${genuine} genuine reviews`}>
        <circle cx="60" cy="60" r={r} className="donut-track" fill="none" strokeWidth="16" />
        {total > 0 && share > 0 && (
          <circle
            cx="60"
            cy="60"
            r={r}
            className="donut-suspicious"
            fill="none"
            strokeWidth="16"
            strokeDasharray={`${share * c} ${c}`}
            transform="rotate(-90 60 60)"
          />
        )}
        <text x="60" y="58" textAnchor="middle" className="donut-number">
          {total ? Math.round(share * 100) : 0}%
        </text>
        <text x="60" y="74" textAnchor="middle" className="chart-axis">
          suspicious
        </text>
      </svg>
      <ul className="legend">
        <li>
          <span className="swatch swatch-suspicious" /> Suspicious <strong>{suspicious}</strong>
        </li>
        <li>
          <span className="swatch swatch-genuine" /> Genuine <strong>{genuine}</strong>
        </li>
      </ul>
    </figure>
  );
}
