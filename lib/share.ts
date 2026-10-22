import { plainSummary, riskLevel } from "./risk";
import type { CheckResult, ReviewItem } from "./types";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** A short note for the manager about a genuine complaint, ready to send on WhatsApp. */
export function buildManagerMessage(opts: {
  restaurant: string;
  review: ReviewItem;
  result: CheckResult;
  suggestedReply?: string;
}): string {
  const { restaurant, review, result, suggestedReply } = opts;
  const risk = riskLevel(result);
  const heading =
    risk === "high" ? "possible fake review, please take a look" : risk === "medium" ? "review to look into" : "guest complaint to follow up";
  const lines = [
    `*${restaurant || "Restaurant"}: ${heading}*`,
    `${review.rating}/5 on Google, ${day(review.date)} (${review.author})`,
    `"${review.text}"`,
    "",
    `Checked with DineTrust: ${risk} risk${typeof result.score === "number" ? ` (score ${result.score}/100)` : ""}.`,
    plainSummary(result),
  ];
  if (suggestedReply?.trim()) lines.push("", "Suggested public reply:", suggestedReply.trim());
  return lines.join("\n");
}

/** Opens WhatsApp (app or web) with the text filled in. The person picks who to send it to. */
export const whatsappLink = (text: string) => `https://wa.me/?text=${encodeURIComponent(text)}`;
