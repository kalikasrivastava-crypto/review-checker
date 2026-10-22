import type { Stats } from "@/lib/dashboard";

const W = 360;
const H = 200;
const PAD = { l: 28, r: 12, t: 14, b: 34 };

/** Weekly average rating as a line. Drawn with plain SVG so it adds no dependency. */
export default function TrendChart({ trend }: { trend: Stats["trend"] }) {
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (trend.length === 1 ? innerW / 2 : (i / (trend.length - 1)) * innerW);
  const y = (v: number) => PAD.t + innerH - ((v - 1) / 4) * innerH;
  const points = trend.map((t, i) => (t.avg === null ? null : { x: x(i), y: y(t.avg), ...t }));
  const drawn = points.filter((p): p is NonNullable<typeof p> => p !== null);
  const line = drawn.map((p) => `${p.x},${p.y}`).join(" ");
  const step = trend.length > 6 ? 2 : 1;

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Average star rating per week">
        {[1, 2, 3, 4, 5].map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} className="chart-grid" />
            <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" className="chart-axis">
              {v}
            </text>
          </g>
        ))}
        {drawn.length > 1 && <polyline points={line} className="chart-line" fill="none" />}
        {drawn.map((p) => (
          <circle key={p.label} cx={p.x} cy={p.y} r={4.5} className="chart-dot">
            <title>{`Week from ${p.label}: average ${p.avg?.toFixed(1)} from ${p.count} review${p.count === 1 ? "" : "s"}`}</title>
          </circle>
        ))}
        {trend.map((t, i) =>
          i % step === 0 || i === trend.length - 1 ? (
            <text
              key={t.label}
              x={x(i)}
              y={H - 12}
              textAnchor={i === trend.length - 1 && trend.length > 1 ? "end" : i === 0 ? "start" : "middle"}
              className="chart-axis"
            >
              {t.label}
            </text>
          ) : null,
        )}
      </svg>
      <figcaption className="sr-only">
        {trend.map((t) => `Week from ${t.label}: ${t.avg === null ? "no reviews" : `average ${t.avg.toFixed(1)}`}.`).join(" ")}
      </figcaption>
    </figure>
  );
}
