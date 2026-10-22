import type { Footfall } from "@/lib/insights";

const HEAD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const dayNumber = (date: string) => Number(date.slice(8));
const label = (date: string) =>
  new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

/** A week-by-week calendar: shading shows how busy each day really was; red dots mark claimed visits. */
export default function FootfallView({ footfall }: { footfall: Footfall }) {
  return (
    <div className="footfall">
      <div className="ff-grid" role="grid" aria-label="Busy-ness by day, with claimed visits">
        {HEAD.map((h) => (
          <div key={h} className="ff-head" role="columnheader">
            {h}
          </div>
        ))}
        {footfall.days.map((d) => {
          const heat = Math.round((d.covers / footfall.maxCovers) * 75);
          const summary = !d.inRecords
            ? "no bills on file for this date"
            : `${d.bills} bill${d.bills === 1 ? "" : "s"}, ${d.covers} guests`;
          const claims = d.claims.length
            ? `. ${d.claims.length} bad review${d.claims.length === 1 ? "" : "s"} claim a visit: ${d.claims.map((c) => c.author).join(", ")}`
            : "";
          return (
            <div
              key={d.date}
              role="gridcell"
              className={`ff-cell ${d.inRecords ? "" : "ff-none"} ${d.inRecords && d.bills === 0 ? "ff-empty" : ""}`}
              style={d.inRecords && d.bills > 0 ? { background: `color-mix(in srgb, var(--accent) ${heat}%, var(--surface))` } : undefined}
              aria-label={`${label(d.date)}: ${summary}${claims}`}
              title={`${label(d.date)}: ${summary}${claims}`}
            >
              <span className="ff-date">{dayNumber(d.date)}</span>
              <span className="ff-stat">{d.inRecords ? `${d.bills} bills` : "no data"}</span>
              {d.claims.length > 0 && (
                <span className="ff-dots" aria-hidden="true">
                  {d.claims.map((c) => (
                    <span key={c.id} className="ff-dot" />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <ul className="ff-legend">
        <li>
          <span className="ff-swatch ff-swatch-busy" /> Busier days are darker ({footfall.tables} tables)
        </li>
        <li>
          <span className="ff-swatch ff-swatch-none" /> No bills on file
        </li>
        <li>
          <span className="ff-dot" /> A 1–2 star review claims a visit that day
        </li>
      </ul>
    </div>
  );
}
