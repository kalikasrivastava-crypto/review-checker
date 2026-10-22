"use client";

import ColumnGuide from "./ColumnGuide";
import UploadStep from "./UploadStep";
import type { CustomRecords, Order, Reservation } from "@/lib/records";

type Kind = "bills" | "reservations";

const EMPTY: CustomRecords = { orders: null, ordersName: "", reservations: null, reservationsName: "" };

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
  custom: CustomRecords | null;
  onChange: (next: CustomRecords) => void;
}

/** One upload box with its template download, a column table, a preview and friendly errors. */
export default function RecordsBox({ kind, custom, onChange }: Props) {
  const c = COPY[kind];
  const loaded = kind === "bills" ? custom?.orders : custom?.reservations;
  const name = kind === "bills" ? custom?.ordersName : custom?.reservationsName;
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
      {loaded && (
        <p className="notice notice-success">
          ✓ {loaded.length.toLocaleString()} {kind === "bills" ? "bills" : "reservations"} loaded from {name}. Upload another file to replace them.
        </p>
      )}
      <UploadStep
        kind={kind}
        onUse={(fileName, records) =>
          onChange(
            kind === "bills"
              ? { ...(custom ?? EMPTY), orders: records as Order[], ordersName: fileName }
              : { ...(custom ?? EMPTY), reservations: records as Reservation[], reservationsName: fileName },
          )
        }
      />
    </section>
  );
}
