import type { AnalysisMethod } from "@/lib/ai-analysis";

/** Says which method produced the results on screen: "AI analysis" or "Keyword analysis". */
export default function MethodBar({ method, saved }: { method: AnalysisMethod; saved: boolean }) {
  const ai = method.kind === "ai";
  return (
    <p style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, margin: 0 }}>
      <span>Method:</span>
      <span className={`badge ${ai ? "badge--accent" : "badge--mixed"}`}>{ai ? "AI analysis" : "Keyword analysis"}</span>
      <span className="muted">
        {ai
          ? "Gemini labelled each review. Every count is worked out by this app from your reviews."
          : method.note
            ? `${method.note} Keyword rules were used instead.`
            : "Phrase rules, no AI."}
      </span>
      {saved && (
        <span className="muted" title="Counts only. No review text or names are saved.">
          · Saved
        </span>
      )}
    </p>
  );
}
