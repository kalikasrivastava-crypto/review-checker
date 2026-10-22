"use client";

import { buildEvidencePdf } from "./evidence-pdf";
import { createRasterizer } from "./raster";
import type { CheckResult, ReviewItem } from "./types";

/** Builds the case PDF in the browser and downloads it. Hindi and other scripts are drawn so they print correctly. */
export async function downloadCasePdf(opts: { restaurant: string; review: ReviewItem; result: CheckResult }): Promise<void> {
  const raster = await createRasterizer();
  const bytes = buildEvidencePdf({ ...opts, generatedOn: new Date(), raster });
  const url = URL.createObjectURL(new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  const slug = opts.review.author.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "review";
  link.download = `dinetrust-case-${slug}-${opts.review.date.slice(0, 10)}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
