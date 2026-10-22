import { PdfDoc, type Rasterizer } from "./pdf";
import { plainSummary, RISK_LABEL, riskLevel, sortedFactors, type Risk } from "./risk";
import type { CheckResult, ReviewItem } from "./types";

const STATUS_LABEL = { match: "Match", mismatch: "Mismatch", no_record: "No record" } as const;

const TONE: Record<Risk, { color: [number, number, number]; fill: [number, number, number] }> = {
  high: { color: [0.72, 0.13, 0.11], fill: [0.99, 0.9, 0.88] },
  low: { color: [0.09, 0.5, 0.24], fill: [0.89, 0.96, 0.9] },
  medium: { color: [0.72, 0.42, 0], fill: [0.99, 0.94, 0.8] },
};

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

/** An evidence report the owner can attach to a Google "report review" request. Returns the PDF bytes. */
export function buildEvidencePdf(opts: {
  restaurant: string;
  review: ReviewItem;
  result: CheckResult;
  generatedOn: Date;
  /** Draws Hindi and other non-Latin text. Without it, those letters print as "?". */
  raster?: Rasterizer | null;
}): Uint8Array {
  const { restaurant, review, result, generatedOn } = opts;
  const doc = new PdfDoc(opts.raster ?? null);
  const muted: [number, number, number] = [0.42, 0.34, 0.26];

  const risk = riskLevel(result);
  const forGoogle = risk === "high";
  doc.text(forGoogle ? "Evidence report" : "Case report", { size: 22, font: "bold" });
  doc.text(`${restaurant || "Restaurant"} · prepared ${longDate(generatedOn.toISOString())}`, { size: 10.5, color: muted });
  doc.gap(6);
  doc.rule();
  doc.gap(6);

  doc.text(forGoogle ? "Review being reported" : "Review checked", { size: 12, font: "bold" });
  doc.text(`${review.rating}-star review by ${review.author}, posted ${longDate(review.date)}`, { size: 10, color: muted });
  doc.gap(2);
  doc.text(`"${review.text}"`, { font: "italic", size: 10.5 });
  doc.gap(10);

  doc.text("Our assessment", { size: 12, font: "bold" });
  doc.gap(4);
  doc.stamp(RISK_LABEL[risk], TONE[risk].color, TONE[risk].fill);
  doc.text(`Risk score ${result.score ?? "n/a"} out of 100. Verdict: ${result.verdict}, confidence ${result.confidence}%.`, { size: 10, color: muted });
  doc.text(plainSummary(result), { size: 10.5 });
  doc.gap(10);

  if (result.breakdown && result.breakdown.length > 0) {
    doc.text("Why this score", { size: 12, font: "bold" });
    doc.gap(2);
    for (const f of sortedFactors(result.breakdown)) {
      doc.text(`${f.points > 0 ? "+" : "-"}${Math.abs(f.points)}   ${f.label}`, { size: 10 });
    }
    doc.gap(10);
  }

  doc.text("Claims in the review compared with our records", { size: 12, font: "bold" });
  doc.gap(4);
  if (result.checks.length === 0) {
    doc.text("The review makes no factual claims that can be checked.", { size: 10 });
  } else {
    doc.table(
      ["Claim in the review", "Result", "What our records show"],
      result.checks.map((c) => [`"${c.claim}"`, STATUS_LABEL[c.status], c.record]),
      [doc.width * 0.36, doc.width * 0.15, doc.width * 0.49],
    );
  }
  doc.gap(8);

  doc.rule();
  doc.gap(4);
  doc.text(
    forGoogle
      ? "These points come from the restaurant's own opening hours, table capacity, reservation and bill records. They show where the review's details do not fit those records. This is a reasoned suspicion, not proof, and the restaurant is asking Google to review the post against its content policies. No customer names or payment details are included."
      : "This summary compares the review with the restaurant's own opening hours, table capacity, reservation and bill records. Missing evidence means a claim could not be confirmed. It is not proof that a review is fake. No customer names or payment details are included.",
    { size: 9, color: muted },
  );

  return doc.build(`Evidence report - ${restaurant || "Restaurant"}`);
}
