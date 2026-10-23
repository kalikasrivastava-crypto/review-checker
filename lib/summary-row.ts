import type { AnalysisResult } from "./analysis";
import type { PrioritiesResult } from "./priorities";

/**
 * The only thing saved after an analysis: counts and labels. It is built from the numbers in the analysis, so it
 * cannot contain review text, reviewer names or the file name. The database also rejects anything shaped differently.
 */
export interface SummaryRow {
  review_count: number;
  data_source: "sample" | "upload";
  theme_counts: Record<string, { mentions: number; positive: number; negative: number; mixed: number }>;
  top_priorities: { rank: number; theme: string; concerned_reviews: number }[];
}

export function buildSummaryRow(analysis: AnalysisResult, priorities: PrioritiesResult, kind: "sample" | "upload"): SummaryRow {
  return {
    review_count: analysis.reviewCount,
    data_source: kind,
    theme_counts: Object.fromEntries(
      analysis.themes.map((t) => [t.key, { mentions: t.reviews, positive: t.positive, negative: t.negative, mixed: t.mixed }]),
    ),
    top_priorities: priorities.priorities.slice(0, 3).map((p) => ({ rank: p.rank, theme: p.label, concerned_reviews: p.concernedReviews })),
  };
}
