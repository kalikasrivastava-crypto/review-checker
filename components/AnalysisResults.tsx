import PrioritiesSection from "./PrioritiesSection";
import ThemeCard from "./ThemeCard";
import type { AnalysisResult } from "@/lib/analysis";

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** The results: a rating summary, then one card per theme, most mentioned first. */
export default function AnalysisResults({ analysis, isSample }: { analysis: AnalysisResult; isSample: boolean }) {
  // Most mentioned first; "Other" is a catch-all, so it always comes last.
  const mentioned = analysis.themes
    .filter((t) => t.reviews > 0)
    .sort((a, b) => Number(a.key === "other") - Number(b.key === "other") || b.reviews - a.reviews);
  const silent = analysis.themes.filter((t) => t.reviews === 0);
  const maxStars = Math.max(1, ...Object.values(analysis.ratingCounts));

  return (
    <div className="stack" aria-live="polite">
      <section className="panel">
        <div className="tc-head">
          <h2>What customers mention</h2>
          {isSample && <span className="chip chip-plausible">Sample data</span>}
        </div>
        {isSample && (
          <p className="notice notice-warning sample-banner">
            <strong>Sample data.</strong> These results come from {plural(analysis.reviewCount, "made-up review")}, not from a real restaurant.
          </p>
        )}
        <p className="muted small">
          A review can mention several themes, so the theme counts add up to more than the number of reviews. Counts are reviews, not sentences.
        </p>

        <dl className="dq-list">
          <div className="dq-main">
            <dt>Reviews analysed</dt>
            <dd>{analysis.reviewCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Average rating</dt>
            <dd>{analysis.averageRating === null ? "No ratings" : `${analysis.averageRating.toFixed(1)} of 5`}</dd>
          </div>
          <div>
            <dt>Reviews with a rating</dt>
            <dd>{analysis.ratedCount.toLocaleString()}</dd>
          </div>
          <div>
            <dt>Matched no theme</dt>
            <dd>{analysis.reviewsWithNoTheme.toLocaleString()}</dd>
          </div>
        </dl>

        {analysis.ratedCount > 0 && (
          <ul className="rating-bars" aria-label="Reviews per star rating">
            {([5, 4, 3, 2, 1] as const).map((n) => (
              <li key={n}>
                <span className="rb-label">{n} ★</span>
                <span className="rb-track" aria-hidden="true">
                  <span style={{ width: `${(analysis.ratingCounts[n] / maxStars) * 100}%` }} />
                </span>
                <span className="rb-count">{analysis.ratingCounts[n].toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}

        <details className="tc-method">
          <summary>How this was worked out</summary>
          <ul className="plain-list small">
            <li>
              Each review is split into short pieces and checked against lists of phrases for each theme. Nothing is sent to an AI, and your file
              stays in your browser.
            </li>
            <li>A &ldquo;not&rdquo; or &ldquo;never&rdquo; just before a phrase turns it around, so &ldquo;not cold&rdquo; is not counted as a concern.</li>
            <li>A theme is &ldquo;mostly positive&rdquo; or &ldquo;mostly negative&rdquo; when at least 60% of its reviews lean that way. Otherwise it is &ldquo;mixed&rdquo;.</li>
            <li>
              &ldquo;Where to look first&rdquo; ranks the five main themes by how many reviews raise a concern in them. An area needs at least 3 such reviews to
              appear. The next steps are general suggestions written in advance, not findings about your restaurant.
            </li>
            <li>It reads English only, can misread sarcasm or unusual wording, and only finds phrases it knows. Treat the counts as a guide to what customers mention, not as proof of why things happen.</li>
          </ul>
        </details>
      </section>

      <PrioritiesSection analysis={analysis} isSample={isSample} />

      {mentioned.map((t) => (
        <ThemeCard key={t.key} theme={t} totalReviews={analysis.reviewCount} />
      ))}
      {silent.map((t) => (
        <ThemeCard key={t.key} theme={t} totalReviews={analysis.reviewCount} />
      ))}
    </div>
  );
}
