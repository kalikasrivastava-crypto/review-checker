import type { Review } from "./types";

const STOP = new Set(
  "a an and are as at be been but by for from had has have i in is it its me my of on or our so that the their them then there they this to was we were what when with you your".split(" "),
);

const words = (text: string) => text.toLowerCase().replace(/[^a-z\s]/g, " ").split(/\s+/).filter(Boolean);

function jaccard<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

function profile(text: string) {
  const all = words(text);
  const content = new Set(all.filter((w) => !STOP.has(w) && w.length > 2));
  const grams = new Set<string>();
  for (let i = 0; i + 2 < all.length; i++) grams.add(`${all[i]} ${all[i + 1]} ${all[i + 2]}`);
  return { content, grams };
}

export interface Similar {
  id: string;
  author: string;
  score: number; // 0-1
}

const MIN_CONTENT_WORDS = 7;
const CONTENT_THRESHOLD = 0.6;
const PHRASE_THRESHOLD = 0.3;

/** How alike two reviews read: shared key words AND shared three-word phrases. Short reviews never match. */
export function similarity(a: string, b: string): number {
  const pa = profile(a);
  const pb = profile(b);
  if (pa.content.size < MIN_CONTENT_WORDS || pb.content.size < MIN_CONTENT_WORDS) return 0;
  const content = jaccard(pa.content, pb.content);
  const phrases = jaccard(pa.grams, pb.grams);
  return content >= CONTENT_THRESHOLD && phrases >= PHRASE_THRESHOLD ? content : 0;
}

/** The most look-alike other review, if any is alike enough. */
export function mostSimilar(review: Review, others: Review[]): Similar | null {
  let best: Similar | null = null;
  for (const o of others) {
    if (o.id && o.id === review.id) continue;
    if (o.text === review.text && o.date === review.date) continue; // itself
    const score = similarity(review.text, o.text);
    if (score > 0 && (!best || score > best.score)) best = { id: o.id ?? "", author: o.author ?? "another reviewer", score };
  }
  return best;
}
