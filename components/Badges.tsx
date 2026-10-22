import type { Entry, Status } from "./AppProvider";
import type { Verdict } from "@/lib/types";

const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  checked: "Checked",
  replied: "Replied",
  reported: "Reported",
};

export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge-status status-${status}`}>{STATUS_LABEL[status]}</span>;
}

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  return <span className={`verdict-chip chip-${verdict.toLowerCase()}`}>{verdict}</span>;
}

export function EntryBadges({ entry }: { entry: Entry }) {
  return (
    <span className="badge-row">
      <StatusBadge status={entry.status} />
      {entry.result && <VerdictChip verdict={entry.result.verdict} />}
    </span>
  );
}
