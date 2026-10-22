import Stars from "./Stars";
import { StatusBadge } from "./Badges";
import type { Entry } from "./AppProvider";
import { claimSegments } from "@/lib/risk";
import type { CheckResult, ReviewItem } from "@/lib/types";

const fullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** The review as a quote card. If it has been checked, the claims that were checked are underlined. */
export default function ReviewQuote({
  review,
  entry,
  result,
  children,
}: {
  review: ReviewItem;
  entry: Entry;
  result?: CheckResult;
  children?: React.ReactNode;
}) {
  const segments = result ? claimSegments(review.text, result) : [{ text: review.text, status: null }];
  const marked = segments.some((s) => s.status);

  return (
    <section className="panel quote-card">
      <div className="detail-head">
        <div className="review-head">
          <span className="review-author">{review.author}</span>
          <Stars rating={review.rating} />
          <span>{fullDate(review.date)}</span>
        </div>
        <StatusBadge status={entry.status} />
      </div>

      <blockquote className="quote" lang={/[ऀ-ॿ]/.test(review.text) ? "hi" : undefined}>
        {segments.map((s, i) =>
          s.status ? (
            <mark key={i} className={`claim claim-${s.status}`} title={s.title}>
              {s.text}
            </mark>
          ) : (
            <span key={i}>{s.text}</span>
          ),
        )}
      </blockquote>

      {marked && (
        <p className="claim-legend">
          Underlined = checked against your records:
          <span className="claim claim-match">matches</span>
          <span className="claim claim-mismatch">conflicts</span>
          <span className="claim claim-unverified">can&apos;t verify</span>
        </p>
      )}
      {entry.note && <p className="notice notice-warning">{entry.note}</p>}
      {children}
    </section>
  );
}
