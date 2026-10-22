import type { CheckResult, Review } from "./types";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * A short evidence summary the owner can paste into Google's "report review" form.
 * Built in plain code from the checks, so it only states what the records show, and it holds no
 * customer names or bill details.
 */
export function buildRemovalReport(review: Review, result: CheckResult): string {
  const conflicts = result.checks.filter((c) => c.status === "mismatch");
  const lines = [
    `Review reported: ${review.rating}-star review posted on ${day(review.date)}.`,
    "",
    "I believe this review may not reflect a genuine customer experience, for these reasons:",
  ];
  conflicts.forEach((c, i) => lines.push(`${i + 1}. The review says "${c.claim}". ${c.record}`));
  if (result.burst) {
    lines.push(`${conflicts.length + 1}. It is one of several one-star reviews posted within 24 hours of each other.`);
  }
  if (conflicts.length === 0 && !result.burst) {
    lines.push("1. The review's claims could not be matched to any visit in our records.");
  }
  lines.push(
    "",
    "These points come from our own opening hours, table capacity, reservation and order records. I am asking Google to review this against its content policies.",
  );
  return lines.join("\n");
}
