import { parseCsv } from "./csv";

export interface Order {
  billId: string;
  date: string; // YYYY-MM-DD
  minutes: number; // minutes after midnight
  partySize: number;
  items: string;
}

export interface Reservation {
  ref: string; // booking number, if the file has one
  date: string;
  minutes: number;
  partySize: number;
}

export interface ServiceWindow {
  name: string; // "Lunch" or "Dinner"
  open: string;
  close: string;
}

/** What the checks need to know about the restaurant. Built from the owner's settings. */
export interface Hours {
  maxPartySize: number;
  tables: number;
  seatsPerTable: number; // typical seats at one table, to work out how many tables a party needs
  mealMinutes: number; // how long a party typically keeps its table
  days: Record<string, ServiceWindow[]>; // an empty list means closed that day
}

export interface Records {
  orders: Order[];
  reservations: Reservation[];
  hours: Hours;
}

export function toMinutes(time: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((time ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Accepts 2026-10-13, 2026/10/13, 13/10/2026 (day first unless the middle part is above 12), and ISO date-times. */
export function normalizeDate(value: string): string | null {
  const v = value.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(v);
  let y: number, mo: number, d: number;
  if (m) {
    [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  } else {
    m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})\b/.exec(v);
    if (!m) return null;
    let a = Number(m[1]);
    let b = Number(m[2]);
    y = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    if (b > 12 && a <= 12) [a, b] = [b, a]; // month/day/year
    [d, mo] = [a, b];
  }
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const check = new Date(y, mo - 1, d);
  if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) return null;
  return `${y}-${pad(mo)}-${pad(d)}`;
}

/** Accepts 19:30, 19.30, 7:30 PM, 7pm and ISO date-times. Returns minutes after midnight. */
export function normalizeTime(value: string): number | null {
  const v = value.trim().toLowerCase();
  const m = /(?:^|[t\s])(\d{1,2})(?:[:.](\d{2}))?(?::\d{2})?\s*(am|pm|a\.m\.|p\.m\.)?\s*$/.exec(v);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.[0];
  if (!m[2] && !ap) return null; // a bare number is not a time
  if (ap) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (ap === "p" ? 12 : 0);
  }
  return h < 24 && min < 60 ? h * 60 + min : null;
}

export function normalizePartySize(value: string): number | null {
  const m = /\d+/.exec(value);
  const n = m ? Number(m[0]) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 500 ? n : null;
}

export type RecordField = "date" | "time" | "party_size" | "bill_id" | "items";
export type Mapping = Partial<Record<RecordField, number>>; // field -> column index

export const REQUIRED_FIELDS: RecordField[] = ["date", "time", "party_size"];

/** Guess which column holds which field from the header names. */
export function guessMapping(headers: string[], sample: string[][] = []): Mapping {
  const patterns: [RecordField, RegExp][] = [
    ["bill_id", /bill|receipt|invoice|check\s?(no|id|#)|order\s?(no|id|#)|ticket|reservation[\s_-]?(no|id|number|#|ref)|booking[\s_-]?(no|id|number|#|ref)/i],
    ["party_size", /party|guest|cover|pax|people|diner|size/i],
    ["items", /item|dish|menu|product|food|order(?!\s?(no|id|#))/i],
    ["time", /time|hour|slot|seated|arriv|clock/i],
    ["date", /date|day|visit|booked|booking|when/i],
  ];
  const mapping: Mapping = {};
  const used = new Set<number>();
  for (const [field, re] of patterns) {
    const idx = headers.findIndex((h, i) => !used.has(i) && re.test(h));
    if (idx !== -1) {
      mapping[field] = idx;
      used.add(idx);
    }
  }
  // A single date-time column can feed both fields.
  if (mapping.date !== undefined && mapping.time === undefined) {
    const col = mapping.date;
    const looksLikeDateTime = /time|stamp/i.test(headers[col]) || sample.some((r) => /\d[T\s]\d{1,2}:\d{2}/.test(r[col] ?? ""));
    if (looksLikeDateTime) mapping.time = col;
  }
  return mapping;
}

export interface MapResult<T> {
  records: T[];
  skipped: number;
}

function mapRows(rows: string[][], mapping: Mapping, build: (cell: (f: RecordField) => string) => unknown): MapResult<never> {
  const records: unknown[] = [];
  let skipped = 0;
  for (const row of rows) {
    const cell = (f: RecordField) => (mapping[f] === undefined ? "" : (row[mapping[f] as number] ?? "").trim());
    const rec = build(cell);
    if (rec) records.push(rec);
    else skipped++;
  }
  return { records: records as never[], skipped };
}

export function mapOrders(rows: string[][], mapping: Mapping): MapResult<Order> {
  return mapRows(rows, mapping, (cell) => {
    const date = normalizeDate(cell("date"));
    const minutes = normalizeTime(cell("time"));
    const partySize = normalizePartySize(cell("party_size"));
    if (!date || minutes === null || partySize === null) return null;
    return { billId: cell("bill_id"), date, minutes, partySize, items: cell("items") } satisfies Order;
  }) as MapResult<Order>;
}

export function mapReservations(rows: string[][], mapping: Mapping): MapResult<Reservation> {
  return mapRows(rows, mapping, (cell) => {
    const date = normalizeDate(cell("date"));
    const minutes = normalizeTime(cell("time"));
    const partySize = normalizePartySize(cell("party_size"));
    if (!date || minutes === null || partySize === null) return null;
    return { ref: cell("bill_id"), date, minutes, partySize } satisfies Reservation;
  }) as MapResult<Reservation>;
}

/**
 * Plain-language problems in the rows (row 1 is the header, so the first data row is row 2).
 * Returns the first few, e.g. "Row 7: time 'late' should look like 20:00 (or 8:15 PM)".
 */
export function rowProblems(rows: string[][], mapping: Mapping, limit = 5): { problems: string[]; total: number } {
  const problems: string[] = [];
  let total = 0;
  rows.forEach((row, i) => {
    if (row.every((c) => !c.trim())) return;
    const cell = (f: RecordField) => (mapping[f] === undefined ? "" : (row[mapping[f] as number] ?? "").trim());
    const found: string[] = [];
    if (normalizeDate(cell("date")) === null) found.push(`date '${cell("date")}' should look like 2026-10-17`);
    if (normalizeTime(cell("time")) === null) found.push(`time '${cell("time")}' should look like 20:00 (or 8:15 PM)`);
    if (normalizePartySize(cell("party_size")) === null) found.push(`party_size '${cell("party_size")}' should be a number like 4`);
    if (found.length === 0) return;
    total++;
    if (problems.length < limit) problems.push(`Row ${i + 2}: ${found.join("; ")}`);
  });
  return { problems, total };
}

/** The first row is the header. */
export function splitCsv(text: string): { headers: string[]; rows: string[][] } {
  const [headers = [], ...rows] = parseCsv(text);
  return { headers: headers.map((h) => h.trim()), rows };
}

// Used when loading the built-in sample files (header names are already the standard ones).
export function parseOrders(text: string): Order[] {
  const { headers, rows } = splitCsv(text);
  return mapOrders(rows, guessMapping(headers, rows)).records;
}

export function parseReservations(text: string): Reservation[] {
  const { headers, rows } = splitCsv(text);
  return mapReservations(rows, guessMapping(headers, rows)).records;
}

export const MAX_UPLOAD_ROWS = 15000;

/** Re-checks records posted by the browser, so the server never trusts the shape. */
export function sanitizeUploaded(input: unknown): { orders: Order[]; reservations: Reservation[] } | null {
  if (!input || typeof input !== "object") return null;
  const body = input as { orders?: unknown; reservations?: unknown };
  const arr = (v: unknown) => (Array.isArray(v) ? v.slice(0, MAX_UPLOAD_ROWS) : []);
  const orders = arr(body.orders).flatMap((o): Order[] => {
    const r = o as Partial<Order>;
    if (typeof r?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return [];
    if (!Number.isFinite(r.minutes) || !Number.isFinite(r.partySize)) return [];
    return [{ billId: String(r.billId ?? "").slice(0, 40), date: r.date, minutes: Number(r.minutes), partySize: Number(r.partySize), items: String(r.items ?? "").slice(0, 400) }];
  });
  const reservations = arr(body.reservations).flatMap((o): Reservation[] => {
    const r = o as Partial<Reservation>;
    if (typeof r?.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return [];
    if (!Number.isFinite(r.minutes) || !Number.isFinite(r.partySize)) return [];
    return [{ ref: String(r.ref ?? "").slice(0, 40), date: r.date, minutes: Number(r.minutes), partySize: Number(r.partySize) }];
  });
  return { orders, reservations };
}

/** Records the owner uploaded. Kept in the browser; a missing file means "no records", not demo data. */
export interface CustomRecords {
  orders: Order[] | null;
  ordersName: string;
  reservations: Reservation[] | null;
  reservationsName: string;
}
