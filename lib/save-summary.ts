"use client";

import { supabase, supabaseConfigured } from "./supabase-browser";
import type { SummaryRow } from "./summary-row";

export type SaveResult = "saved" | "skipped" | "failed";

/** Saves the summary using the existing Supabase connection. Never throws: the analysis must show whatever happens here. */
export async function saveSummary(row: SummaryRow): Promise<SaveResult> {
  if (!supabaseConfigured) return "skipped";
  try {
    // No .select(): the table allows insert only, so the row can't be read back.
    const { error } = await supabase().from("analysis_summaries").insert(row);
    return error ? "failed" : "saved";
  } catch {
    return "failed";
  }
}
