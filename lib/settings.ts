import type { Hours } from "./records";

export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface ServiceWindow {
  on: boolean;
  start: string; // HH:MM
  end: string; // HH:MM
}

export interface DaySettings {
  open: boolean;
  lunch: ServiceWindow;
  dinner: ServiceWindow;
}

/** Everything the owner tells us about the restaurant. All checks use these values. */
export interface RestaurantSettings {
  name: string;
  phone: string;
  email: string;
  tables: number;
  /** Typical seats at one table. A party of 9 at 4 seats a table needs 3 tables. */
  seatsPerTable: number;
  /** How long a party typically keeps its table, in minutes. */
  mealMinutes: number;
  maxPartySize: number;
  days: Record<Weekday, DaySettings>;
}

export const DEFAULT_SEATS_PER_TABLE = 4;
export const DEFAULT_MEAL_MINUTES = 90;

const dinner = (start: string, end: string): DaySettings => ({
  open: true,
  lunch: { on: false, start: "12:00", end: "15:00" },
  dinner: { on: true, start, end },
});

export const DEMO_SETTINGS: RestaurantSettings = {
  name: "Trattoria Demo",
  phone: "+91 98765 43210",
  email: "hello@trattoriademo.example",
  tables: 12,
  seatsPerTable: DEFAULT_SEATS_PER_TABLE,
  mealMinutes: DEFAULT_MEAL_MINUTES,
  maxPartySize: 8,
  days: {
    monday: { ...dinner("17:00", "22:00"), open: false },
    tuesday: dinner("17:00", "22:00"),
    wednesday: dinner("17:00", "22:00"),
    thursday: dinner("17:00", "22:00"),
    friday: dinner("17:00", "23:00"),
    saturday: dinner("17:00", "23:00"),
    sunday: dinner("17:00", "21:00"),
  },
};

/** A fresh form for a new owner: lunch and dinner every day with typical times, only the name left to fill in. */
export const BLANK_SETTINGS: RestaurantSettings = {
  name: "",
  phone: "",
  email: "",
  tables: 12,
  seatsPerTable: DEFAULT_SEATS_PER_TABLE,
  mealMinutes: DEFAULT_MEAL_MINUTES,
  maxPartySize: 10,
  days: Object.fromEntries(
    WEEKDAYS.map((d) => [
      d,
      {
        open: true,
        lunch: { on: true, start: "12:00", end: "15:00" },
        dinner: { on: true, start: "19:00", end: "23:00" },
      },
    ]),
  ) as Record<Weekday, DaySettings>,
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** What the checks see: for each weekday, the list of service windows (empty = closed). */
export function toHours(s: RestaurantSettings): Hours {
  const days: Hours["days"] = {};
  for (const d of WEEKDAYS) {
    const day = s.days[d];
    const windows: Hours["days"][string] = [];
    if (day.open) {
      if (day.lunch.on) windows.push({ name: "Lunch", open: day.lunch.start, close: day.lunch.end });
      if (day.dinner.on) windows.push({ name: "Dinner", open: day.dinner.start, close: day.dinner.end });
    }
    days[d] = windows;
  }
  return {
    maxPartySize: s.maxPartySize,
    tables: s.tables,
    seatsPerTable: s.seatsPerTable || DEFAULT_SEATS_PER_TABLE,
    mealMinutes: s.mealMinutes || DEFAULT_MEAL_MINUTES,
    days,
  };
}

export type Section = "basics" | "hours" | "capacity";
export interface Issue {
  section: Section;
  message: string;
}

/** Problems with the form, in plain words, grouped by section. Empty means it is fine to save. */
export function settingsIssues(s: RestaurantSettings): Issue[] {
  const issues: Issue[] = [];
  const add = (section: Section, message: string) => issues.push({ section, message });
  if (!s.name.trim()) add("basics", "Add your restaurant's name.");
  if (s.email.trim() && !/^\S+@\S+\.\S+$/.test(s.email.trim())) add("basics", "That email address doesn't look right.");
  if (!Number.isInteger(s.tables) || s.tables < 1 || s.tables > 500) add("capacity", "Number of tables must be between 1 and 500.");
  if (!Number.isInteger(s.maxPartySize) || s.maxPartySize < 1 || s.maxPartySize > 200) {
    add("capacity", "Largest party you can seat must be between 1 and 200.");
  }
  if (!Number.isInteger(s.seatsPerTable) || s.seatsPerTable < 1 || s.seatsPerTable > 50) {
    add("capacity", "Seats per table must be between 1 and 50.");
  }
  if (!Number.isInteger(s.mealMinutes) || s.mealMinutes < 15 || s.mealMinutes > 360) {
    add("capacity", "Time a table is used must be between 15 and 360 minutes.");
  }
  let anyOpen = false;
  for (const d of WEEKDAYS) {
    const day = s.days[d];
    if (!day.open) continue;
    anyOpen = true;
    if (!day.lunch.on && !day.dinner.on) add("hours", `${cap(d)} is open, but neither lunch nor dinner is switched on.`);
    for (const [label, w] of [["Lunch", day.lunch], ["Dinner", day.dinner]] as const) {
      if (!w.on) continue;
      if (!TIME.test(w.start) || !TIME.test(w.end)) add("hours", `${cap(d)} ${label.toLowerCase()}: enter a start and end time.`);
      else if (toMin(w.end) <= toMin(w.start)) {
        add("hours", `${cap(d)} ${label.toLowerCase()}: the end time must be after the start (for after midnight, use 23:59).`);
      }
    }
    if (day.lunch.on && day.dinner.on && TIME.test(day.lunch.end) && TIME.test(day.dinner.start) && toMin(day.lunch.end) > toMin(day.dinner.start)) {
      add("hours", `${cap(d)}: lunch ends after dinner starts.`);
    }
  }
  if (!anyOpen) add("hours", "Switch on at least one day you are open.");
  return issues;
}

export const settingsProblems = (s: RestaurantSettings): string[] => settingsIssues(s).map((i) => i.message);

const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function windowOf(v: unknown, fallback: ServiceWindow): ServiceWindow {
  const w = (v ?? {}) as Partial<ServiceWindow>;
  return {
    on: w.on === true,
    start: typeof w.start === "string" && TIME.test(w.start) ? w.start : fallback.start,
    end: typeof w.end === "string" && TIME.test(w.end) ? w.end : fallback.end,
  };
}

/** Re-checks settings posted by the browser. Returns null if they aren't usable, so the demo settings apply. */
export function sanitizeSettings(input: unknown): RestaurantSettings | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Partial<RestaurantSettings>;
  const days = {} as Record<Weekday, DaySettings>;
  for (const d of WEEKDAYS) {
    const rd = (raw.days?.[d] ?? {}) as Partial<DaySettings>;
    days[d] = {
      open: rd.open === true,
      lunch: windowOf(rd.lunch, BLANK_SETTINGS.days[d].lunch),
      dinner: windowOf(rd.dinner, BLANK_SETTINGS.days[d].dinner),
    };
  }
  const tables = Math.round(Number(raw.tables));
  const maxPartySize = Math.round(Number(raw.maxPartySize));
  const seatsPerTable = Math.round(Number(raw.seatsPerTable));
  const mealMinutes = Math.round(Number(raw.mealMinutes));
  const out: RestaurantSettings = {
    name: text(raw.name, 80),
    phone: text(raw.phone, 40),
    email: text(raw.email, 80),
    tables: Number.isFinite(tables) ? Math.min(500, Math.max(1, tables)) : 10,
    maxPartySize: Number.isFinite(maxPartySize) ? Math.min(200, Math.max(1, maxPartySize)) : 8,
    seatsPerTable: Number.isFinite(seatsPerTable) && seatsPerTable >= 1 ? Math.min(50, seatsPerTable) : DEFAULT_SEATS_PER_TABLE,
    mealMinutes: Number.isFinite(mealMinutes) && mealMinutes >= 15 ? Math.min(360, mealMinutes) : DEFAULT_MEAL_MINUTES,
    days,
  };
  return settingsProblems({ ...out, name: out.name || "x" }).length ? null : out;
}

/** "+91 98765 43210 or hello@example.com", used to fill the contact gap in reply drafts. */
export function contactText(s: RestaurantSettings | null): string {
  if (!s) return "";
  return [s.phone.trim(), s.email.trim()].filter(Boolean).join(" or ");
}

/** Short summary of one day's hours, e.g. "Dinner 17:00–22:00". */
export function describeDay(windows: { name: string; open: string; close: string }[]): string {
  return windows.length ? windows.map((w) => `${w.name} ${w.open}–${w.close}`).join(", ") : "closed";
}

/** Settings saved before seats-per-table and meal length existed get sensible defaults. */
export function normalizeSettings(raw: RestaurantSettings): RestaurantSettings {
  return {
    ...raw,
    seatsPerTable: raw.seatsPerTable || DEFAULT_SEATS_PER_TABLE,
    mealMinutes: raw.mealMinutes || DEFAULT_MEAL_MINUTES,
  };
}
