import type { Entry } from "@/components/AppProvider";
import type { Screen } from "./insights";
import type { ReviewItem } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface Stats {
  avgRating: number | null;
  avgDelta: number | null; // this week minus the week before
  thisWeek: number;
  prevWeek: number;
  suspiciousPct: number | null;
  suspiciousCount: number;
  genuineCount: number;
  checkedCount: number;
  waitingReply: number;
  trend: { label: string; avg: number | null; count: number }[];
  attention: ReviewItem[];
}

/** A review counts as suspicious if its AI check says so; otherwise the code-only screen decides. */
export function isSuspicious(r: ReviewItem, entry: Entry | undefined, screens: Record<string, Screen> | undefined): boolean {
  if (entry?.result) return entry.result.verdict === "Suspicious";
  return !!screens?.[r.id]?.flagged;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function computeStats(
  reviews: ReviewItem[],
  entries: Record<string, Entry>,
  screens: Record<string, Screen> | undefined,
  anchor: Date,
): Stats {
  const end = anchor.getTime();
  const inWeek = (r: ReviewItem, k: number) => {
    const t = new Date(r.date).getTime();
    return t <= end - k * 7 * DAY_MS && t > end - (k + 1) * 7 * DAY_MS;
  };

  const week0 = reviews.filter((r) => inWeek(r, 0));
  const week1 = reviews.filter((r) => inWeek(r, 1));
  const a0 = avg(week0.map((r) => r.rating));
  const a1 = avg(week1.map((r) => r.rating));

  const suspicious = reviews.filter((r) => isSuspicious(r, entries[r.id], screens));
  const checkedCount = reviews.filter((r) => entries[r.id]?.result).length;

  const oldest = Math.min(...reviews.map((r) => new Date(r.date).getTime()));
  const weeks = Math.min(8, Math.max(2, Math.ceil((end - oldest) / (7 * DAY_MS))));
  const trend = Array.from({ length: weeks }, (_, i) => {
    const k = weeks - 1 - i;
    const bucket = reviews.filter((r) => inWeek(r, k));
    const start = new Date(end - (k + 1) * 7 * DAY_MS + DAY_MS);
    return {
      label: start.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      avg: avg(bucket.map((r) => r.rating)),
      count: bucket.length,
    };
  });

  const open = (r: ReviewItem) => {
    const s = entries[r.id]?.status ?? "new";
    return s === "new" || s === "checked";
  };

  return {
    avgRating: avg(reviews.map((r) => r.rating)),
    avgDelta: a0 !== null && a1 !== null ? a0 - a1 : null,
    thisWeek: week0.length,
    prevWeek: week1.length,
    suspiciousPct: reviews.length ? Math.round((suspicious.length / reviews.length) * 100) : null,
    suspiciousCount: suspicious.length,
    genuineCount: reviews.length - suspicious.length,
    checkedCount,
    waitingReply: reviews.filter((r) => r.rating <= 3 && open(r)).length,
    trend,
    attention: reviews.filter((r) => r.rating <= 2 && open(r)).slice(0, 5), // reviews arrive newest first
  };
}
