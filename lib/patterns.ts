import type { Review } from "./types";

const HOUR_MS = 60 * 60 * 1000;
const BURST_WINDOW_MS = 72 * HOUR_MS;
const BURST_MIN_REVIEWS = 3;
const LOW_STAR = 2;

export interface Burst {
  ids: Set<string>;
  count: number;
  from: string;
  to: string;
}

/**
 * Finds clusters of 3 or more 1-2 star reviews inside a 72-hour window.
 * Returns null when there is no burst.
 */
export function findBurst(reviews: Review[]): Burst | null {
  const low = reviews
    .filter((r) => r.rating <= LOW_STAR && r.id)
    .map((r) => ({ id: r.id as string, date: r.date, t: new Date(r.date).getTime() }))
    .sort((a, b) => a.t - b.t);

  const inBurst = new Map<string, number>();
  for (const start of low) {
    const window = low.filter((r) => r.t >= start.t && r.t <= start.t + BURST_WINDOW_MS);
    if (window.length >= BURST_MIN_REVIEWS) window.forEach((r) => inBurst.set(r.id, r.t));
  }
  if (inBurst.size === 0) return null;

  const times = [...inBurst.values()];
  return {
    ids: new Set(inBurst.keys()),
    count: inBurst.size,
    from: new Date(Math.min(...times)).toISOString(),
    to: new Date(Math.max(...times)).toISOString(),
  };
}

const EMOTION =
  /\b(worst|awful|terrible|horrible|disgusting|filthy|rude|never|hate|hated|nightmare|appalling|dreadful|pathetic|scam|avoid|stay away|do not go|don'?t go|ever)\b|!/i;

const TIME = /\b\d{1,2}(:\d{2})?\s?(a\.?m\.?|p\.?m\.?)(?![a-z])|\b(noon|midnight|o'clock)\b/i;

const PARTY =
  /\b(party|table|group|reservation|booking)\s+(of|for)\s+\w+|\b(\d+|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(of us|people|guests|friends|adults|diners)\b|\bjust the (two|three|four) of us\b/i;

const DISH =
  /\b(steak|soup|pizza|pasta|salad|burger|burgers|chicken|fish|salmon|lasagna|risotto|gnocchi|linguine|calamari|bruschetta|burrata|tiramisu|panna cotta|dessert|appetizers?|starters?|mains?|fries|sandwich|sushi|curry|noodles|steaks|wine|cocktail|coffee|bread)\b/i;

/** Strong emotion with no time, party size or dish to check it against. */
export function isLowDetail(text: string): boolean {
  const hasSpecifics = TIME.test(text) || PARTY.test(text) || DISH.test(text);
  return EMOTION.test(text) && !hasSpecifics;
}

export type Tag = "Low detail" | "Part of a burst";

export function reviewTags(review: Review, burst: Burst | null): Tag[] {
  const tags: Tag[] = [];
  if (isLowDetail(review.text)) tags.push("Low detail");
  if (burst && review.id && burst.ids.has(review.id)) tags.push("Part of a burst");
  return tags;
}
