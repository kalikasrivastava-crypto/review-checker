import Stars from "./Stars";
import { MAX_CONCERNS, type ThemeKey, type ThemeResult, type Tone } from "@/lib/analysis";

const HELP: Record<ThemeKey, string> = {
  food: "Taste, temperature, freshness and how the food was cooked.",
  speed: "Waiting for a table, for food, for orders to be taken or for the bill.",
  clean: "Tables, cutlery, washrooms, pests and hygiene in the food.",
  price: "Prices, the bill, portion size and value for money.",
  ambience: "Noise, music, temperature, seating, decor and atmosphere.",
  other: "Anything that didn't fit the five main themes: staff attitude, parking, bookings, and general remarks.",
};

const SENTIMENT: Record<Tone, { label: string; chip: string }> = {
  positive: { label: "Mostly positive", chip: "chip-verified" },
  negative: { label: "Mostly negative", chip: "chip-suspicious" },
  mixed: { label: "Mixed", chip: "chip-plausible" },
};

const pct = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "0%");
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const niceDate = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** One theme: how many reviews mention it, whether those lean positive or negative, the concerns and some real examples. */
export default function ThemeCard({ theme, totalReviews }: { theme: ThemeResult; totalReviews: number }) {
  if (theme.reviews === 0 || !theme.sentiment) {
    return (
      <section className="panel theme-card theme-empty" aria-label={theme.label}>
        <h3>{theme.label}</h3>
        <p className="muted small">No reviews mention this theme.</p>
      </section>
    );
  }
  const s = SENTIMENT[theme.sentiment];
  const concerns = theme.concerns.slice(0, MAX_CONCERNS);
  return (
    <section className="panel theme-card" aria-label={theme.label}>
      <div className="tc-head">
        <h3>{theme.label}</h3>
        <span className={`chip ${s.chip}`}>{s.label}</span>
      </div>
      <p className="muted small tc-help">{HELP[theme.key]}</p>

      <p className="tc-mentions">
        Mentioned in <strong>{theme.reviews.toLocaleString()}</strong> of {totalReviews.toLocaleString()} reviews ({pct(theme.reviews, totalReviews)})
      </p>

      <div
        className="tc-bar"
        role="img"
        aria-label={`${theme.positive} positive, ${theme.mixed} positive and negative, ${theme.negative} negative reviews`}
      >
        {theme.positive > 0 && <span className="tc-pos" style={{ flexGrow: theme.positive }} />}
        {theme.mixed > 0 && <span className="tc-mix" style={{ flexGrow: theme.mixed }} />}
        {theme.negative > 0 && <span className="tc-neg" style={{ flexGrow: theme.negative }} />}
      </div>
      <ul className="tc-legend">
        <li>
          <span className="tc-dot tc-pos" /> {plural(theme.positive, "positive review")}
        </li>
        <li>
          <span className="tc-dot tc-mix" /> {plural(theme.mixed, "review")} with both
        </li>
        <li>
          <span className="tc-dot tc-neg" /> {plural(theme.negative, "negative review")}
        </li>
      </ul>

      <h4 className="tc-sub">Concerns customers mention most</h4>
      {concerns.length === 0 ? (
        <p className="muted small">No specific concerns were picked up for this theme.</p>
      ) : (
        <ul className="tc-concerns">
          {concerns.map((c) => (
            <li key={c.label}>
              <div className="tc-concern-line">
                <span>{c.label}</span>
                <strong>{plural(c.reviews, "review")}</strong>
              </div>
              <div className="tc-concern-bar" aria-hidden="true">
                <span style={{ width: `${Math.max(4, Math.round(c.share * 100))}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {theme.examples.length > 0 && (
        <details className="tc-examples">
          <summary>See {plural(theme.examples.length, "example review")}</summary>
          <ul>
            {theme.examples.map((e, i) => (
              <li key={i}>
                <blockquote>“{e.text}”</blockquote>
                <p className="tc-example-meta small muted">
                  {e.rating !== null && <Stars rating={Math.round(e.rating)} />}
                  {e.date && <span>{niceDate(e.date)}</span>}
                  <span>Leans {e.tone === "mixed" ? "both ways" : e.tone} on this theme</span>
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
