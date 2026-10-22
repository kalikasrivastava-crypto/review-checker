import Stars from "./Stars";
import { MAX_CONCERNS, type ThemeKey, type ThemeResult, type Tone } from "@/lib/analysis";
import { niceDate, pct, plural } from "@/lib/format";

const HELP: Record<ThemeKey, string> = {
  food: "Taste, temperature, freshness and how the food was cooked.",
  speed: "Waiting for a table, for food, for orders to be taken or for the bill.",
  clean: "Tables, cutlery, washrooms, pests and hygiene in the food.",
  price: "Prices, the bill, portion size and value for money.",
  ambience: "Noise, music, temperature, seating, decor and atmosphere.",
  other: "Anything that didn't fit the five main themes: staff attitude, parking, bookings, and general remarks.",
};

const SENTIMENT: Record<Tone, { label: string; badge: string }> = {
  positive: { label: "Mostly positive", badge: "badge--positive" },
  negative: { label: "Mostly negative", badge: "badge--negative" },
  mixed: { label: "Mixed", badge: "badge--mixed" },
};

/** One theme: how many reviews mention it, which way they lean, the concerns raised and some real examples. */
export default function ThemeCard({ theme, totalReviews }: { theme: ThemeResult; totalReviews: number }) {
  if (theme.reviews === 0 || !theme.sentiment) {
    return (
      <section className="card theme" aria-label={theme.label}>
        <div className="theme__head">
          <h3>{theme.label}</h3>
          <span className="badge">No mentions</span>
        </div>
        <p className="theme__help">No reviews mention this theme.</p>
      </section>
    );
  }
  const s = SENTIMENT[theme.sentiment];
  const concerns = theme.concerns.slice(0, MAX_CONCERNS);
  return (
    <section className="card theme" aria-label={theme.label}>
      <div className="theme__head">
        <h3>{theme.label}</h3>
        <span className={`badge ${s.badge}`}>{s.label}</span>
      </div>
      <p className="theme__help">{HELP[theme.key]}</p>

      <p className="theme__mentions">
        Mentioned in <strong>{theme.reviews.toLocaleString()}</strong> of {totalReviews.toLocaleString()} reviews ({pct(theme.reviews, totalReviews)})
      </p>
      <div className="sbar" role="img" aria-label={`${theme.positive} positive, ${theme.mixed} positive and negative, ${theme.negative} negative reviews`}>
        {theme.positive > 0 && <span className="sbar__pos" style={{ flexGrow: theme.positive }} />}
        {theme.mixed > 0 && <span className="sbar__mix" style={{ flexGrow: theme.mixed }} />}
        {theme.negative > 0 && <span className="sbar__neg" style={{ flexGrow: theme.negative }} />}
      </div>
      <ul className="theme__legend">
        <li>
          <span className="legend__dot sbar__pos" />
          {plural(theme.positive, "positive review")}
        </li>
        <li>
          <span className="legend__dot sbar__mix" />
          {plural(theme.mixed, "review")} with both
        </li>
        <li>
          <span className="legend__dot sbar__neg" />
          {plural(theme.negative, "negative review")}
        </li>
      </ul>

      <h4>Concerns customers mention most</h4>
      {concerns.length === 0 ? (
        <p className="card__sub">No specific concerns were picked up for this theme.</p>
      ) : (
        <ul className="concerns">
          {concerns.map((c) => (
            <li key={c.label}>
              <div className="concerns__line">
                <span>{c.label}</span>
                <strong>{plural(c.reviews, "review")}</strong>
              </div>
              <div className="meter" aria-hidden="true">
                <span style={{ width: `${Math.max(4, Math.round(c.share * 100))}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {theme.examples.length > 0 && (
        <details className="examples details">
          <summary>See {plural(theme.examples.length, "example review")}</summary>
          <ul>
            {theme.examples.map((e, i) => (
              <li key={i}>
                <blockquote>“{e.text}”</blockquote>
                <p className="examples__meta">
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
