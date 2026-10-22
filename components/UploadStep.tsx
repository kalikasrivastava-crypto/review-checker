"use client";

import { useState } from "react";
import {
  guessMapping,
  mapOrders,
  mapReservations,
  MAX_UPLOAD_ROWS,
  REQUIRED_FIELDS,
  splitCsv,
  type Mapping,
  type Order,
  type RecordField,
  type Reservation,
} from "@/lib/records";

type Kind = "bills" | "reservations";

const FIELDS: Record<Kind, { field: RecordField; label: string }[]> = {
  bills: [
    { field: "date", label: "Date" },
    { field: "time", label: "Time" },
    { field: "party_size", label: "Party size" },
    { field: "bill_id", label: "Bill number (optional)" },
    { field: "items", label: "Items ordered (optional)" },
  ],
  reservations: [
    { field: "date", label: "Date" },
    { field: "time", label: "Time" },
    { field: "party_size", label: "Party size" },
  ],
};

interface Props {
  kind: Kind;
  onUse: (name: string, records: Order[] | Reservation[]) => void;
}

const minutesToText = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

export default function UploadStep({ kind, onUse }: Props) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("That file is over 3 MB. Export a shorter date range and try again.");
      return;
    }
    try {
      const { headers: h, rows: r } = splitCsv(await file.text());
      if (h.length === 0 || r.length === 0) {
        setError("That file has no rows. It needs a header row and at least one data row.");
        return;
      }
      if (r.length > MAX_UPLOAD_ROWS) {
        setError(`That file has ${r.length.toLocaleString()} rows; the limit is ${MAX_UPLOAD_ROWS.toLocaleString()}. Export a shorter date range.`);
        return;
      }
      setFileName(file.name);
      setHeaders(h);
      setRows(r);
      setMapping(guessMapping(h, r));
    } catch {
      setError("Couldn't read that file. Is it a CSV?");
    }
  }

  const result = rows.length ? (kind === "bills" ? mapOrders(rows, mapping) : mapReservations(rows, mapping)) : null;
  const missing = REQUIRED_FIELDS.filter((f) => mapping[f] === undefined);
  const ready = !!result && missing.length === 0 && result.records.length > 0;

  function reset() {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
  }

  return (
    <div className="upload-step">
      <label className="field">
        {kind === "bills" ? "Bills CSV" : "Reservations CSV"}
        <input type="file" accept=".csv,text/csv" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      {error && <p className="notice notice-error">{error}</p>}

      {headers.length > 0 && (
        <>
          <p className="muted">
            <strong>Step 2: match your columns.</strong> We guessed from the headers in {fileName}. Change any that are
            wrong. Dates like 13/10/2026 are read day first.
          </p>
          <div className="mapping-grid">
            {FIELDS[kind].map(({ field, label }) => (
              <label className="field" key={field}>
                {label}
                <select
                  value={mapping[field] ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMapping((m) => {
                      const next = { ...m };
                      if (v === "") delete next[field];
                      else next[field] = Number(v);
                      return next;
                    });
                  }}
                >
                  <option value="">— none —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          {missing.length > 0 && (
            <p className="notice notice-warning">
              Still needed: {missing.map((f) => f.replace("_", " ")).join(", ")}.
            </p>
          )}

          {result && missing.length === 0 && (
            <>
              <p>
                <strong>{result.records.length.toLocaleString()}</strong> rows ready
                {result.skipped > 0 && <>, {result.skipped.toLocaleString()} skipped (bad date, time or party size)</>}.
              </p>
              {result.records.length > 0 && (
                <ul className="preview-list">
                  {(result.records as (Order | Reservation)[]).slice(0, 3).map((r, i) => (
                    <li key={i}>
                      {r.date} {minutesToText(r.minutes)} · party of {r.partySize}
                      {"items" in r && r.items ? ` · ${r.items.slice(0, 40)}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          <div className="actions">
            <button
              type="button"
              className="btn btn-solid"
              disabled={!ready}
              onClick={() => {
                if (result) onUse(fileName, result.records as Order[] | Reservation[]);
                reset();
              }}
            >
              Use these {kind === "bills" ? "bills" : "reservations"}
            </button>
            <button type="button" className="btn" onClick={reset}>
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}
