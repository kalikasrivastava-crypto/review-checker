import Icon from "./Icons";
import type { ClaimGroups, ClaimRow } from "@/lib/risk";
import type { Visit } from "@/lib/types";

export const claimDomId = (id: string) => `claim-${id.replace(/[^a-zA-Z0-9]+/g, "_")}`;

const PILL = { mismatch: "Mismatch", match: "Match", unverified: "Can't verify" } as const;

function Row({ row, focused }: { row: ClaimRow; focused: boolean }) {
  return (
    <li id={claimDomId(row.id)} className={`crow crow-${row.status} ${focused ? "is-focus" : ""}`}>
      <div className="crow-head">
        <p className="crow-quote">&ldquo;{row.claim}&rdquo;</p>
        <span className={`crow-pill crow-pill-${row.status}`}>{PILL[row.status]}</span>
      </div>
      <ul className="clines">
        {row.lines.map((l, i) => (
          <li key={i} className={`cline cline-${l.status}`}>
            <span className="cline-icon">
              <Icon name={l.status === "mismatch" ? "cross" : l.status === "match" ? "check" : "question"} />
            </span>
            <span className="source-tag">{l.source ?? "Not recorded"}</span>
            <span className="cline-text">{l.text}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

function Group({
  kind,
  title,
  sub,
  icon,
  rows,
  empty,
  note,
  focusId,
}: {
  kind: "mismatch" | "match" | "unverified";
  title: string;
  sub: string;
  icon: "cross" | "check" | "question";
  rows: ClaimRow[];
  empty: string;
  note?: string;
  focusId: string | null;
}) {
  return (
    <section className={`cg cg-${kind}`} aria-label={title}>
      <h3 className="cg-head">
        <span className="cg-icon">
          <Icon name={icon} />
        </span>
        {title}
        <span className="cg-count">{rows.length}</span>
      </h3>
      <p className="cg-sub">{sub}</p>
      {rows.length === 0 ? (
        <p className="cg-empty">{empty}</p>
      ) : (
        <ul className="crows">
          {rows.map((r) => (
            <Row key={r.id} row={r} focused={focusId === r.id} />
          ))}
        </ul>
      )}
      {note && rows.length > 0 && <p className="cg-note">{note}</p>}
    </section>
  );
}

/** Every claim in the review, in three groups: conflicts with the records, matches, and what can't be verified. */
export default function ClaimBreakdown({ groups, visit, focusId }: { groups: ClaimGroups; visit?: Visit | null; focusId: string | null }) {
  const busy = visit ? (visit.rank === 1 ? "the busiest day on file" : visit.rank <= 2 ? "one of the busiest days on file" : "a quieter day") : "";
  return (
    <div className="claims">
      <h2 className="claims-title">Claim by claim</h2>
      {visit && (
        <p className="visit-line">
          <Icon name="busy" />
          <span>
            <strong>{visit.label}</strong> was {busy}: {visit.bills} bill{visit.bills === 1 ? "" : "s"}, {visit.covers} guests.
          </span>
          <span className="source-tag">Visitor counts</span>
        </p>
      )}
      <Group
        kind="mismatch"
        title="Confirmed mismatch"
        sub="Your records directly contradict the claim."
        icon="cross"
        rows={groups.mismatch}
        empty="No claim conflicts with your records."
        focusId={focusId}
      />
      <Group
        kind="match"
        title="Confirmed match"
        sub="Your records support the claim."
        icon="check"
        rows={groups.match}
        empty="No claim could be matched to a record."
        focusId={focusId}
      />
      <Group
        kind="unverified"
        title="Can't verify / missing data"
        sub="We have no record either way."
        icon="question"
        rows={groups.unverified}
        empty="Everything we could check had a record."
        note="Missing data is not proof the review is untrue."
        focusId={focusId}
      />
    </div>
  );
}
