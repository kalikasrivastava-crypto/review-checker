import { buildPriorities } from "@/lib/priorities";
import type { AnalysisResult } from "@/lib/analysis";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/** The top areas to look at first, with practical next steps. Ranks what customers mention; it does not explain causes. */
export default function PrioritiesSection({ analysis, isSample }: { analysis: AnalysisResult; isSample: boolean }) {
  const { priorities, smallSample, totalReviews } = buildPriorities(analysis);

  return (
    <section className="panel priorities" aria-labelledby="priorities-title">
      <div className="tc-head">
        <h2 id="priorities-title">Where to look first</h2>
        {isSample && <span className="chip chip-plausible">Sample data</span>}
      </div>
      <p className="muted small">
        These areas come up most in the concerns customers raise. They show what customers mention, not why it happens, so use them as a place to
        start checking.
      </p>
      {isSample && (
        <p className="notice notice-warning sample-banner">
          <strong>Sample data.</strong> The priorities below come from made-up reviews and say nothing about a real restaurant.
        </p>
      )}
      {smallSample && (
        <p className="notice notice-warning">
          Only {plural(totalReviews, "review")} {totalReviews === 1 ? "was" : "were"} analysed. Treat this as an early signal rather than a clear pattern.
        </p>
      )}

      {priorities.length === 0 ? (
        <p className="notice">
          No area has enough concerns to call it a priority yet. An area needs at least 3 reviews raising a concern. That can simply mean few
          reviews, or that few of them raised concerns.
        </p>
      ) : (
        <>
          {priorities.length < 3 && (
            <p className="muted small">
              Only {plural(priorities.length, "area")} had at least 3 reviews raising a concern, so fewer than three priorities are shown.
            </p>
          )}
          <ol className="priority-list">
            {priorities.map((p) => (
              <li key={p.key} className="priority">
                <div className="priority-head">
                  <span className="priority-num" aria-hidden="true">
                    {p.rank}
                  </span>
                  <h3>{p.label}</h3>
                </div>
                <p className="priority-evidence">
                  <strong>
                    {p.concernedReviews.toLocaleString()} of {totalReviews.toLocaleString()} reviews ({pct(p.shareOfAll)})
                  </strong>{" "}
                  raise a concern about {p.label.toLowerCase()}.{" "}
                  <span className="muted">
                    {p.themeReviews.toLocaleString()} reviews mention it in total, and {p.positiveReviews.toLocaleString()} of those were positive.
                  </span>
                </p>

                <h4 className="tc-sub">{p.frequent ? "Customers frequently mention" : "Mentioned in a few reviews"}</h4>
                <ul className="priority-concerns">
                  {p.concerns.map((c) => (
                    <li key={c.label}>
                      <span>{c.label}</span>
                      <strong>{plural(c.reviews, "review")}</strong>
                    </li>
                  ))}
                </ul>

                <h4 className="tc-sub">Practical next steps to consider</h4>
                <ul className="priority-steps">
                  {p.steps.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </>
      )}
      <p className="muted small">
        Priorities are ranked by how many reviews raise a concern in each area. &ldquo;Other&rdquo; (staff, parking, bookings and general remarks)
        has its own card but isn&apos;t ranked, because it mixes unrelated things.
      </p>
    </section>
  );
}
