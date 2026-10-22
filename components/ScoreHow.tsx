import Icon from "./Icons";
import { claimRows, groupedFactors } from "@/lib/risk";
import type { CheckResult, Factor, FactorGroup } from "@/lib/types";

const GROUPS: { key: FactorGroup; title: string; hint: string }[] = [
  { key: "mismatch", title: "Conflicts with your records", hint: "These drive the score." },
  { key: "missing", title: "Missing data", hint: "Adds very little." },
  { key: "signal", title: "Other signals", hint: "Capped, and never enough to make a review High risk." },
  { key: "trust", title: "Supporting evidence", hint: "Lowers the score." },
];

/** "How this score was calculated": every point, grouped, and tied to the claim it came from. */
export default function ScoreHow({ result, onJump }: { result: CheckResult; onJump: (claimId: string) => void }) {
  const grouped = groupedFactors(result);
  const rows = claimRows(result);
  const claimOf = (f: Factor) => (f.checkId ? rows.find((r) => r.id === f.checkId) : undefined);

  const raw = result.breakdown?.reduce((sum, f) => sum + f.points, 0) ?? 0;
  const capped = typeof result.score === "number" && raw > result.score && !result.checks.some((c) => c.status === "mismatch");

  return (
    <details className="score-how">
      <summary>How this score was calculated</summary>
      <div className="how-body">
        {grouped === null ? (
          <p className="muted small">This result was saved before the points were recorded. Re-check it to see them.</p>
        ) : result.breakdown.length === 0 ? (
          <p className="muted small">No points were added: nothing in this review conflicts with your records.</p>
        ) : (
          GROUPS.filter((g) => grouped[g.key].length > 0).map((g) => (
            <div key={g.key} className="how-group">
              <h4>
                {g.title} <span className="muted">{g.hint}</span>
              </h4>
              <ul>
                {grouped[g.key].map((f, i) => {
                  const row = claimOf(f);
                  return (
                    <li key={i} className={f.points > 0 ? "how-up" : "how-down"}>
                      <span className="how-icon">
                        <Icon name={f.icon ?? (f.points > 0 ? "info" : "trust")} />
                      </span>
                      <span className="how-label">
                        {f.label}
                        {row && (
                          <button type="button" className="how-link" onClick={() => onJump(row.id)}>
                            From the claim &ldquo;{row.claim.length > 38 ? `${row.claim.slice(0, 36)}…` : row.claim}&rdquo;
                          </button>
                        )}
                      </span>
                      <span className="pts">
                        {f.points > 0 ? "+" : "−"}
                        {Math.abs(f.points)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        {typeof result.score === "number" && (
          <p className="how-total">
            Total: <strong>{result.score}</strong> out of 100
            {capped && <span> (capped: without a confirmed conflict a review can&apos;t reach High risk)</span>}
          </p>
        )}
        <p className="how-note">
          Only a confirmed conflict with your records can make a review High risk. Opinions you can&apos;t check, such as rude staff or cold
          food, add nothing.
        </p>
      </div>
    </details>
  );
}
