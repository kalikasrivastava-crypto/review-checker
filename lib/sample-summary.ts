import { analyseReviews, type Tone } from "./analysis";
import { buildPriorities } from "./priorities";
import { buildReviews, readReviewFile } from "./review-csv";

export interface SampleSummary {
  reviewCount: number;
  averageRating: number | null;
  themes: { key: string; label: string; reviews: number; positive: number; mixed: number; negative: number; sentiment: Tone | null }[];
  topPriority: { label: string; concerned: number } | null;
  priorities: { rank: number; label: string; concerned: number }[];
}

/**
 * The home page's "at a glance" numbers: the real analysis of the sample reviews' CSV text. Nothing here is typed in by
 * hand, and the page always labels it as sample data.
 */
export function summariseSample(csvText: string): SampleSummary {
  const file = readReviewFile(csvText);
  const { reviews } = buildReviews(file.rows, file.guess);
  const analysis = analyseReviews(reviews);
  const priorities = buildPriorities(analysis).priorities;
  const top = priorities[0];
  return {
    reviewCount: analysis.reviewCount,
    averageRating: analysis.averageRating,
    themes: analysis.themes
      .filter((t) => t.reviews > 0)
      .sort((a, b) => Number(a.key === "other") - Number(b.key === "other") || b.reviews - a.reviews)
      .map((t) => ({ key: t.key, label: t.label, reviews: t.reviews, positive: t.positive, mixed: t.mixed, negative: t.negative, sentiment: t.sentiment })),
    topPriority: top ? { label: top.label, concerned: top.concernedReviews } : null,
    priorities: priorities.map((p) => ({ rank: p.rank, label: p.label, concerned: p.concernedReviews })),
  };
}
