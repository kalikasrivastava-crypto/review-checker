import { PdfDoc, type Rasterizer } from "./pdf";
import { explain, groupClaims, groupedFactors, RISK_LABEL, riskLevel, type ClaimRow, type Risk } from "./risk";
import type { CheckResult, ReviewItem } from "./types";

const TONE: Record<Risk, { color: [number, number, number]; fill: [number, number, number] }> = {
  high: { color: [0.72, 0.13, 0.11], fill: [0.99, 0.9, 0.88] },
  low: { color: [0.09, 0.5, 0.24], fill: [0.89, 0.96, 0.9] },
  medium: { color: [0.72, 0.42, 0], fill: [0.99, 0.94, 0.8] },
};

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

const GROUPS: { key: "mismatch" | "match" | "unverified"; title: string; color: [number, number, number]; none: string }[] = [
  { key: "mismatch", title: "Confirmed mismatch: the records conflict with the claim", color: [0.72, 0.13, 0.11], none: "No claim conflicts with the records." },
  { key: "match", title: "Confirmed match: the records support the claim", color: [0.09, 0.5, 0.24], none: "No claim could be matched to a record." },
  { key: "unverified", title: "Can't verify: no record either way", color: [0.34, 0.38, 0.45], none: "Every claim we could check had a record." },
];

function rowCells(row: ClaimRow): string[] {
  return [`"${row.claim}"`, row.lines.map((l) => `${l.source ?? "Not recorded"}: ${l.text}`).join("\n")];
}

/** The case as a PDF the owner can keep or attach to a report to Google. Returns the PDF bytes. */
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

  doc.text("What we found", { size: 12, font: "bold" });
  doc.gap(4);
  doc.stamp(RISK_LABEL[risk], TONE[risk].color, TONE[risk].fill);
  if (typeof result.score === "number") doc.text(`Score ${result.score} out of 100`, { size: 9.5, color: muted });
  doc.text(explain(result), { size: 11 });
  doc.gap(10);

  const groups = groupClaims(result);
  for (const g of GROUPS) {
    doc.text(g.title, { size: 11.5, font: "bold", color: g.color });
    doc.gap(3);
    const rows = groups[g.key];
    if (rows.length === 0) doc.text(g.none, { size: 9.5, color: muted });
    else doc.table(["Claim in the review", "Source, and what the records say"], rows.map(rowCells), [doc.width * 0.32, doc.width * 0.68]);
    if (g.key === "unverified" && rows.length > 0) {
      doc.text("Missing data is not proof the review is untrue.", { size: 9, color: muted, font: "italic" });
    }
    doc.gap(6);
  }

  const factors = groupedFactors(result);
  if (factors && result.breakdown.length > 0) {
    doc.text("How the score was calculated", { size: 12, font: "bold" });
    doc.gap(2);
    const parts: [string, typeof factors.mismatch][] = [
      ["Conflicts with the records", factors.mismatch],
      ["Missing data", factors.missing],
      ["Other signals", factors.signal],
      ["Supporting evidence", factors.trust],
    ];
    for (const [label, list] of parts) {
      for (const f of list) doc.text(`${f.points > 0 ? "+" : "-"}${Math.abs(f.points)}   ${f.label}  (${label.toLowerCase()})`, { size: 9.5 });
    }
    doc.gap(6);
  }

  doc.rule();
  doc.gap(4);
  doc.text(
    forGoogle
      ? "These points come from the restaurant's own opening hours, table capacity, reservation and bill records. They show where details in the review conflict with those records, and the restaurant is asking Google to review the post against its content policies. Missing data is not proof of anything. No customer names or payment details are included."
      : "This summary compares the review with the restaurant's own opening hours, table capacity, reservation and bill records. Claims that could not be checked are marked as such, and missing data is not proof the review is untrue. No customer names or payment details are included.",
    { size: 9, color: muted },
  );

  return doc.build(`Evidence report - ${restaurant || "Restaurant"}`);
}
