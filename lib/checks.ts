import fs from "node:fs";
import path from "node:path";
import hoursData from "@/data/hours.json";
import seededReviews from "@/data/reviews.json";
import type { Claim, Evidence, Review, Risk } from "./types";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const HOURS = hoursData as Record<string, { open: string; close: string } | null>;
const WINDOW_MINUTES = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

interface Order {
  date: string;
  minutes: number;
  partySize: number;
}

let ordersCache: Order[] | null = null;
function loadOrders(): Order[] {
  if (!ordersCache) {
    const csv = fs.readFileSync(path.join(process.cwd(), "data", "orders.csv"), "utf8");
    ordersCache = csv
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((line) => {
        const [date, time, size] = line.split(",");
        return { date, minutes: toMinutes(time) ?? 0, partySize: Number(size) };
      });
  }
  return ordersCache;
}

function toMinutes(time: string | null): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

function ymd(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** The visit came before the review, so a weekday means its most recent occurrence. */
function resolveDate(claim: Claim, reviewDate: Date): string | null {
  if (claim.date && /^\d{4}-\d{2}-\d{2}$/.test(claim.date)) return claim.date;
  if (!claim.weekday) return null;
  const idx = WEEKDAYS.indexOf(claim.weekday);
  if (idx === -1) return null;
  const d = new Date(reviewDate.getFullYear(), reviewDate.getMonth(), reviewDate.getDate());
  d.setDate(d.getDate() - ((d.getDay() - idx + 7) % 7));
  return ymd(d);
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Look one claim up in the sample orders and opening hours. */
export function checkClaim(claim: Claim, reviewDate: Date): Evidence {
  const base = { claim: claim.text, type: claim.type };
  const noData = (note: string): Evidence => ({ ...base, status: "no_data", note });

  if (claim.type !== "party_size" && claim.type !== "date_time") {
    return noData("No records to check this against.");
  }
  const date = resolveDate(claim, reviewDate);
  if (!date) return noData("Couldn't tell which day this refers to.");

  const dayName = WEEKDAYS[new Date(`${date}T00:00:00`).getDay()];
  const label = `${cap(dayName)} ${date}`;
  const hours = HOURS[dayName];
  const time = toMinutes(claim.time);

  if (hours === null) {
    return { ...base, status: "mismatch", note: `${label}: the restaurant is closed.` };
  }
  if (hours && time !== null && (time < toMinutes(hours.open)! || time > toMinutes(hours.close)!)) {
    return {
      ...base,
      status: "mismatch",
      note: `${label}: open ${hours.open}-${hours.close}, so ${claim.time} is outside opening hours.`,
    };
  }

  if (claim.type === "date_time") {
    return time !== null
      ? { ...base, status: "match", note: `${label}: ${claim.time} is within opening hours.` }
      : noData(`${label}: no time given to check.`);
  }

  const rows = loadOrders().filter((o) => o.date === date);
  if (rows.length === 0) return noData(`No orders on file for ${label}.`);
  if (claim.party_size === null) return noData(`${label}: no party size to check.`);

  const candidates =
    time === null ? rows : rows.filter((o) => Math.abs(o.minutes - time) <= WINDOW_MINUTES);
  const found = candidates.some((o) => o.partySize === claim.party_size);
  const when = time === null ? "" : ` around ${claim.time}`;
  return found
    ? { ...base, status: "match", note: `${label}: found an order for ${claim.party_size}${when}.` }
    : { ...base, status: "mismatch", note: `${label}: no order for ${claim.party_size}${when}.` };
}

/** True when this one-star review sits in a 24-hour window holding 3 or more one-star reviews. */
export function isBurst(review: Review): boolean {
  if (review.rating !== 1) return false;
  const times = (seededReviews as Review[])
    .filter((r) => r.rating === 1 && !(r.date === review.date && r.text === review.text))
    .map((r) => new Date(r.date).getTime());
  const mine = new Date(review.date).getTime();
  times.push(mine);
  return times.some((start) => {
    const inWindow = times.filter((t) => t >= start && t < start + DAY_MS);
    return inWindow.length >= 3 && mine >= start && mine < start + DAY_MS;
  });
}

const LEVELS: Risk[] = ["low", "medium", "high"];

/** Evidence can only raise the AI's risk. "No data" never changes it. */
export function finalRisk(aiRisk: Risk, mismatches: number, burst: boolean): Risk {
  let level = LEVELS.indexOf(aiRisk);
  if (mismatches > 0) level += 1;
  if (burst) level += 1;
  return LEVELS[Math.min(level, LEVELS.length - 1)];
}
