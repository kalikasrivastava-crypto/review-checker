"use client";

import ColumnGuide from "./ColumnGuide";
import UploadStep from "./UploadStep";
import type { Order, Reservation } from "@/lib/records";

type Kind = "bills" | "reservations";

const COPY: Record<Kind, { title: string; help: string; template: string; templateName: string }> = {
  bills: {
    title: "Bills",
    help: "One row per bill. Used to check whether a table of that size paid around the time a review says.",
    template: "/dinetrust-bills-template.csv",
    templateName: "Download bills CSV template",
  },
  reservations: {
    title: "Reservations",
    help: "One row per booking. Used to check claims like “we had booked for 8”.",
    template: "/dinetrust-reservations-template.csv",
    templateName: "Download reservations CSV template",
  },
};

interface Props {
  kind: Kind;
  /** How many rows are saved (or chosen) already, and from which file. */
  count: number;
  fileName: string;
  onUse: (fileName: string, records: Order[] | Reservation[]) => void | Promise<void>;
}

/** One upload box with its template download, a column table, a preview and friendly errors. */
export default function RecordsBox({ kind, count, fileName, onUse }: Props) {
  const c = COPY[kind];
  return (
    <section className="panel records-box">
      <div className="records-box-head">
        <h2>{c.title}</h2>
        <a className="btn btn-small" href={c.template} download>
          {c.templateName}
        </a>
      </div>
      <p className="muted small">{c.help}</p>
      <ColumnGuide kind={kind} />
      {count > 0 && (
        <p className="notice notice-success">
          ✓ {count.toLocaleString()} {kind === "bills" ? "bills" : "reservations"} saved{fileName ? ` from ${fileName}` : ""}. Upload another file to replace them.
        </p>
      )}
      <UploadStep kind={kind} onUse={onUse} />
    </section>
  );
}
