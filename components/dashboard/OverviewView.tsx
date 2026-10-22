import { IconAlert } from "../UiIcons";
import EmptyState from "./EmptyState";
import SampleBar from "./SampleBar";
import type { AnalysisResult } from "@/lib/analysis";
import type { PrioritiesResult } from "@/lib/priorities";
import type { ParseSummary } from "@/lib/review-csv";
import { niceDate, pct, plural } from "@/lib/format";

export interface ActivityItem {
  id: number;
  time: string;
  text: string;
}

interface Props {
  analysis: AnalysisResult | null;
  priorities: PrioritiesResult | null;
  summary: ParseSummary | null;
  isSample: boolean;
  activity: ActivityItem[];
  onGo: (view: "upload" | "themes" | "plan") => void;
  onSample: () => void;
  onUseOwn: () => void;
}

export default function OverviewView({ analysis, priorities, summary, isSample, activity, onGo, onSample, onUseOwn }: Props) {
  if (!analysis || !priorities || !summary) {
    return (
      <div className="stack-16">
        <header className="page-head">
          <div>
            <h1>Overview</h1>
            <p>A summary of what your customers mention, once you have loaded some reviews.</p>
          </div>
        </header>
        <EmptyState
          title="No reviews analysed yet"
          text="Upload a CSV file of customer reviews, or try the sample data, to see themes, ratings and priorities here."
          onUpload={() => onGo("upload")}
          onSample={onSample}
        />
        <ActivityCard activity={activity} />
      </div>
    );
  }

  const themes = analysis.themes
    .filter((t) => t.reviews > 0)
    .sort((a, b) => Number(a.key === "other") - Number(b.key === "other") || b.reviews - a.reviews);
  const max = Math.max(1, ...themes.map((t) => t.reviews));
  const mostMentioned = themes.find((t) => t.key !== "other") ?? themes[0];
  const top = priorities.priorities[0];
  const maxStars = Math.max(1, ...Object.values(analysis.ratingCounts));

  return (
    <div className="stack-16">
      <header className="page-head">
        <div>
          <h1>Overview</h1>
          <p>What customers mention across {plural(analysis.reviewCount, "review")}, and where to look first.</p>
        </div>
        <div className="page-head__actions">
          {isSample ? <span className="badge badge--sample">Sample data</span> : <span className="badge badge--accent">Your reviews</span>}
        </div>
      </header>

      {isSample && <SampleBar count={analysis.reviewCount} onUseOwn={onUseOwn} />}

      <dl className="metrics">
        <div className="metric">
          <dt>Reviews analysed</dt>
          <dd>{analysis.reviewCount.toLocaleString()}</dd>
          {summary.dateFrom && summary.dateTo && <small>{niceDate(summary.dateFrom)} to {niceDate(summary.dateTo)}</small>}
        </div>
        <div className="metric">
          <dt>Average rating</dt>
          <dd>{analysis.averageRating === null ? "–" : `${analysis.averageRating.toFixed(1)} / 5`}</dd>
          <small>{analysis.ratedCount > 0 ? `${plural(analysis.ratedCount, "review")} with a rating` : "No ratings in this file"}</small>
        </div>
        <div className="metric">
          <dt>Most mentioned theme</dt>
          <dd className="metric__text">{mostMentioned ? mostMentioned.label : "–"}</dd>
          <small>{mostMentioned ? `${pct(mostMentioned.reviews, analysis.reviewCount)} of reviews` : "No themes found"}</small>
        </div>
        <div className="metric">
          <dt>Top priority</dt>
          <dd className="metric__text">{top ? top.label : "None yet"}</dd>
          <small>{top ? `${plural(top.concernedReviews, "review")} raise a concern` : "Not enough concerns to rank"}</small>
        </div>
      </dl>

      <div className="grid-2">
        <section className="card card--pad" aria-labelledby="themes-title">
          <div className="card__head">
            <h2 id="themes-title">Feedback themes</h2>
            <button type="button" className="button button--ghost button--sm" onClick={() => onGo("themes")}>
              See all themes
            </button>
          </div>
          <ul className="bars" aria-label="Reviews mentioning each theme">
            {themes.map((t) => (
              <li key={t.key}>
                <div className="bars__line">
                  <span>{t.label}</span>
                  <span className="bars__n">{plural(t.reviews, "review")}</span>
                </div>
                <div className="sbar" style={{ width: `${Math.max(8, (t.reviews / max) * 100)}%` }} role="img" aria-label={`${t.positive} positive, ${t.mixed} both, ${t.negative} negative`}>
                  {t.positive > 0 && <span className="sbar__pos" style={{ flexGrow: t.positive }} />}
                  {t.mixed > 0 && <span className="sbar__mix" style={{ flexGrow: t.mixed }} />}
                  {t.negative > 0 && <span className="sbar__neg" style={{ flexGrow: t.negative }} />}
                </div>
              </li>
            ))}
          </ul>
          <ul className="legend" aria-hidden="true">
            <li><span className="legend__dot sbar__pos" /> Positive</li>
            <li><span className="legend__dot sbar__mix" /> Both</li>
            <li><span className="legend__dot sbar__neg" /> Negative</li>
          </ul>
          <p className="card__sub">A review can mention several themes, so these counts add up to more than the number of reviews.</p>
        </section>

        <section className="card card--pad" aria-labelledby="plan-title">
          <div className="card__head">
            <h2 id="plan-title">Where to look first</h2>
            <button type="button" className="button button--ghost button--sm" onClick={() => onGo("plan")}>
              Open action plan
            </button>
          </div>
          {priorities.priorities.length === 0 ? (
            <p className="card__sub">No area has at least 3 reviews raising a concern yet, so nothing is ranked. That can mean few reviews, or few concerns.</p>
          ) : (
            <ol className="priority-mini">
              {priorities.priorities.map((p) => (
                <li key={p.key}>
                  <span className="plan__num" aria-hidden="true">{p.rank}</span>
                  <span>
                    <strong>{p.label}</strong>
                    <small>{plural(p.concernedReviews, "review")} raise a concern ({pct(p.concernedReviews, analysis.reviewCount)})</small>
                  </span>
                  <span className="badge">Priority {p.rank}</span>
                </li>
              ))}
            </ol>
          )}
          {priorities.smallSample && (
            <div className="alert alert--warning" style={{ marginTop: 14 }}>
              <IconAlert />
              <p>Only {plural(priorities.totalReviews, "review")} analysed, so treat this as an early signal.</p>
            </div>
          )}
        </section>
      </div>

      <div className="grid-2">
        {analysis.ratedCount > 0 && (
          <section className="card card--pad" aria-labelledby="rating-title">
            <h2 id="rating-title" style={{ marginBottom: 14 }}>Rating distribution</h2>
            <ul className="rating-rows" aria-label="Reviews per star rating">
              {([5, 4, 3, 2, 1] as const).map((n) => (
                <li key={n}>
                  <span>{n} ★</span>
                  <span className="meter" aria-hidden="true">
                    <span style={{ width: `${(analysis.ratingCounts[n] / maxStars) * 100}%` }} />
                  </span>
                  <b>{analysis.ratingCounts[n].toLocaleString()}</b>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="card card--pad" aria-labelledby="quality-title">
          <h2 id="quality-title" style={{ marginBottom: 14 }}>Data quality</h2>
          <ul className="checklist">
            <li className="ok"><span>{plural(summary.rowsRead, "row")} read, <strong>{plural(summary.used, "review")}</strong> used</span></li>
            {summary.skippedEmpty + summary.skippedShort > 0 && <li className="off"><span>{plural(summary.skippedEmpty + summary.skippedShort, "row")} skipped (empty or too short)</span></li>}
            {summary.duplicates > 0 && <li className="off"><span>{plural(summary.duplicates, "duplicate")} removed</span></li>}
            {analysis.reviewsWithNoTheme > 0 && <li className="off"><span>{plural(analysis.reviewsWithNoTheme, "review")} matched no theme</span></li>}
            {summary.ratingMissing + summary.ratingUnreadable > 0 && <li className="off"><span>{plural(summary.ratingMissing + summary.ratingUnreadable, "review")} without a usable rating</span></li>}
          </ul>
        </section>
      </div>

      <ActivityCard activity={activity} />
    </div>
  );
}

function ActivityCard({ activity }: { activity: ActivityItem[] }) {
  return (
    <section className="card card--pad" aria-labelledby="activity-title">
      <div className="card__head">
        <h2 id="activity-title">Recent activity</h2>
        <span className="card__sub" style={{ margin: 0 }}>This visit only</span>
      </div>
      {activity.length === 0 ? (
        <p className="card__sub">Nothing yet. Files you load and results you view will appear here.</p>
      ) : (
        <ul className="activity">
          {activity.map((a) => (
            <li key={a.id}>
              <time>{a.time}</time>
              <span>{a.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
