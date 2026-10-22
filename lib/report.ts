import { claimRows } from "./risk";
import type { CheckResult, ReviewItem } from "./types";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/**
 * A short evidence summary the owner can paste into Google's "report review" form. Built in plain
 * code from the records, it states only where the review conflicts with them, and holds no customer
 * names or bill amounts.
 */
export function buildRemovalReport(review: ReviewItem, result: CheckResult): string {
  const conflicts = claimRows(result).filter((r) => r.status === "mismatch");
  const lines = [
    `Review reported: ${review.rating}-star review posted on ${day(review.date)}.`,
    "",
    "Parts of this review conflict with our own records:",
  ];
  if (conflicts.length === 0) {
    lines.push("1. The details in the review could not be matched to any visit in our records.");
  } else {
    conflicts.forEach((row, i) => {
      const found = row.lines.filter((l) => l.status === "mismatch").map((l) => l.text);
      lines.push(`${i + 1}. The review says "${row.claim}". ${found.join(" ")}`);
    });
  }
  lines.push(
    "",
    "These points come from our own opening hours, table capacity, reservation and bill records. I am asking Google to review this against its content policies.",
  );
  return lines.join("\n");
}
