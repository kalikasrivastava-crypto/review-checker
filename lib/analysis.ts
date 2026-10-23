import type { ParsedReview } from "./review-csv";

/**
 * Groups customer reviews into themes using simple keyword rules. No AI is involved, so the same reviews
 * always give the same answer, and every number below is a count of real reviews in the file.
 *
 * How it works, in short:
 *  1. Each review is cut into short pieces (sentences and clauses split at "but", "however" and so on).
 *  2. Each piece is checked against phrase lists for the themes: food, service speed, cleanliness, pricing,
 *     ambience, and "other". Phrases are marked as praise or as a concern.
 *  3. A word like "not" or "never" just before a phrase flips it ("not cold" is not a concern).
 *  4. A theme's mentions are the number of reviews that touch it, and its sentiment comes from how many of
 *     those reviews were positive, negative or both.
 *
 * Limits: it reads English only, can be fooled by sarcasm or unusual wording, and only finds what the phrase
 * lists contain. It shows what customers say, not why it happens.
 */

export type ThemeKey = "food" | "speed" | "clean" | "price" | "ambience" | "other";
export type Tone = "positive" | "negative" | "mixed";

/** A theme counts as positive or negative when at least this share of its reviews lean that way; otherwise it is mixed. */
export const SENTIMENT_SHARE = 0.6;
export const MAX_EXAMPLES = 3;
/** How many concerns a theme card should show. The engine returns all of them, most mentioned first. */
export const MAX_CONCERNS = 5;

interface Rule {
  re: RegExp;
  tone: "pos" | "neg";
  /** What customers are describing, for a negative phrase. */
  concern?: string;
  /** A broad catch-all that only counts when no more specific concern matched in the same piece. */
  generic?: boolean;
}

interface ThemeDef {
  key: ThemeKey;
  label: string;
  /** Used when a piece is negative but no specific concern matched. */
  fallbackConcern: string;
  /** Words that point at this theme. Used only to place a general opinion like "bad" or "lovely". */
  topic: RegExp;
  rules: Rule[];
}

const R = (source: string) => new RegExp(source, "gi");
/** Topic patterns are only tested, never scanned, so they must not use the global flag. */
const T = (source: string) => new RegExp(source, "i");

const THEMES: ThemeDef[] = [
  {
    key: "food",
    label: "Food quality",
    fallbackConcern: "Food described as poor",
    topic: T(
      "\\b(food|dish|dishes|taste|tasted|flavou?rs?|menu|meal|meals|starters?|mains?|main course|dessert|desserts|biryani|curry|dal|naan|roti|pizza|pasta|noodles|kebabs?|dosa|chicken|paneer|soup|salad|rice|burger|sandwich|steak|fish|cooked|coffee|tea|juice|lassi|drinks?|beverages?)\\b",
    ),
    rules: [
      { re: R("\\b(cold|lukewarm|stone cold|not hot|gone cold)\\b(?!\\s+(?:coffee|drink|drinks|beverage|water|brew|dessert|salad|buffet))"), tone: "neg", concern: "Food served cold or lukewarm" },
      { re: R("\\b(bland|tasteless|flavou?rless|no taste|lacked? (?:flavou?r|taste)|needed (?:more |a lot of )?(?:salt|spice|flavou?r))\\b"), tone: "neg", concern: "Bland or lacking flavour" },
      { re: R("\\b(salty|oily|greasy|soggy|too (?:sweet|spicy|heavy)|oversalted)\\b"), tone: "neg", concern: "Too salty, oily or spicy" },
      { re: R("\\b(undercooked|overcooked|raw|burnt|burned|dry|rubbery|chewy|well done)\\b"), tone: "neg", concern: "Undercooked, overcooked or dry" },
      { re: R("\\b(stale|not fresh|reheated|spoiled|rotten)\\b"), tone: "neg", concern: "Stale or not fresh" },
      {
        re: R("\\b(delicious|tasty|flavou?rful|fresh|yummy|mouth.?watering|cooked perfectly|perfectly cooked|well cooked|authentic|homemade|hot and fresh)\\b"),
        tone: "pos",
      },
    ],
  },
  {
    key: "speed",
    label: "Service speed",
    fallbackConcern: "Service described as slow",
    topic: T("\\b(wait|waits|waited|waiting|slow|slowly|quick|quickly|fast|minutes|hour|hours|took|arrive|arrived|seated|delay|delayed)\\b"),
    rules: [
      {
        re: R("\\b(?:waited|wait(?:ing)?|delay(?:ed)?)\\b[^.]{0,30}\\b(?:table|seated|seat|booking|reservation)\\b|\\b(?:table|seated)\\b[^.]{0,25}\\b(?:wait|waiting|waited|delay)\\b"),
        tone: "neg",
        concern: "Long wait for a table",
      },
      {
        re: R("\\b(nobody came|no one came|nobody took|no one took|forgot (?:our|my|the) order|(?:keep )?reminding|never came|didn't take our order|had to (?:keep )?(?:ask|remind|call))\\b"),
        tone: "neg",
        concern: "Orders forgotten or slow to be taken",
      },
      {
        re: R("\\b(?:wait(?:ed)?[^.]{0,20}(?:for|to get) the bill|bill (?:took|was slow)|slow billing)\\b"),
        tone: "neg",
        concern: "Slow bill or payment",
      },
      {
        re: R("\\b(waited|took forever|took (?:ages|too long|so long)|taking forever|long wait|slow|slowly|forever to|an hour|delayed|waiting (?:for|time)|\\d+\\s?(?:minutes|mins) (?:for|to))\\b"),
        tone: "neg",
        concern: "Long wait for food or service",
        generic: true,
      },
      {
        re: R("\\b(quick(?:ly)?|fast|prompt(?:ly)?|no wait(?:ing)?|right away|immediately|came out in minutes|efficient|speedy)\\b"),
        tone: "pos",
      },
    ],
  },
  {
    key: "clean",
    label: "Cleanliness",
    fallbackConcern: "Cleanliness described as poor",
    topic: T("\\b(clean|cleanliness|hygiene|hygienic|washrooms?|restrooms?|toilets?|bathrooms?|cutlery|plates|glasses|kitchen)\\b"),
    rules: [
      {
        re: R("\\b(?:washrooms?|restrooms?|toilets?|bathrooms?)\\b[^.]{0,30}\\b(?:dirty|unclean|filthy|smelly|smell|stink\\w*|not clean|disgusting|bad)\\b|\\b(?:dirty|unclean|filthy|smelly)\\s+(?:washrooms?|restrooms?|toilets?|bathrooms?)\\b"),
        tone: "neg",
        concern: "Unclean washrooms",
      },
      {
        re: R("\\b(sticky|stains?|stained|unwashed|not (?:properly )?(?:cleaned|wiped)|dirty (?:table|tables|plates?|cutlery|glass|glasses|spoons?|forks?))\\b"),
        tone: "neg",
        concern: "Dirty tables or cutlery",
      },
      {
        re: R("\\b(flies|cockroach(?:es)?|insects?|ants|rats?|mosquito(?:es)?|pests?)\\b"),
        tone: "neg",
        concern: "Flies, insects or pests",
      },
      {
        re: R("\\b(hair in|found (?:a )?hair|hair was in|strand of hair|foreign object|plastic in)\\b"),
        tone: "neg",
        concern: "Hair or foreign objects in food",
      },
      {
        re: R("\\b(food poisoning|got sick|felt sick|stomach (?:ache|upset|infection)|upset stomach|vomit\\w*)\\b"),
        tone: "neg",
        concern: "Guests feeling unwell after eating",
      },
      {
        re: R("\\b(dirty|filthy|unhygienic|unclean|messy|not clean|disgusting|gross)\\b"),
        tone: "neg",
        concern: "Place described as dirty or unhygienic",
        generic: true,
      },
      { re: R("\\b(spotless|clean|hygienic|tidy|well.?maintained|sparkling|neat|immaculate|well kept)\\b"), tone: "pos" },
    ],
  },
  {
    key: "price",
    label: "Pricing",
    fallbackConcern: "Prices described as too high",
    topic: T("\\b(price|prices|priced|pricing|bill|cost|costs|charge|charges|charged|value|money|expensive|portion|portions|deal)\\b"),
    rules: [
      {
        re: R("\\b(bill (?:was|is) (?:much |way |a lot )?(?:higher|more)|higher than (?:we |i )?expected|hidden charges?|extra charges?|surprise charges?|charged extra|service charge)\\b"),
        tone: "neg",
        concern: "Bill higher than expected",
      },
      {
        re: R("\\b(small portions?|tiny portions?|portions? (?:was|is|were|are) (?:small|tiny)|not enough food|portion size)\\b"),
        tone: "neg",
        concern: "Portions feel small for the price",
      },
      {
        re: R("\\b(not worth|waste of money|poor value|bad value|quality (?:has )?(?:gone down|not (?:gone|improved)))\\b"),
        tone: "neg",
        concern: "Poor value for money",
      },
      {
        re: R("\\b(overpriced|over.?priced|too expensive|very expensive|pricey|expensive|costly|rip.?off|prices? (?:have |has )?(?:gone|went) up|prices? (?:are|were) (?:high|steep))\\b"),
        tone: "neg",
        concern: "Prices feel too high",
      },
      {
        re: R("\\b(good value|great value|value for money|reasonabl[ey] priced|reasonable prices?|affordable|cheap|worth (?:every|the(?! wait))|great deal|good deal|fair prices?|budget.?friendly|pocket.?friendly|well.?priced|generous portions?|filling portions?|big portions?|prices?\\s+(?:are|were|is|was)\\s+(?:very |quite |really |so )?(?:reasonable|fair|affordable|low|good)|portions?\\s+(?:are|were|is|was)\\s+(?:very |really )?(?:generous|big|large|filling|huge))\\b"),
        tone: "pos",
      },
    ],
  },
  {
    key: "ambience",
    label: "Ambience",
    fallbackConcern: "Ambience described as unpleasant",
    topic: T("\\b(ambien(?:ce|t)|atmosphere|decor|decoration|music|seating|interior|lighting|vibes?|space|noise|crowd|view|environment)\\b"),
    rules: [
      {
        re: R("\\b(noisy|too loud|very loud|loud music|loud|noise|couldn't hear|could not hear|deafening)\\b"),
        tone: "neg",
        concern: "Too noisy or loud",
      },
      {
        re: R("\\b(ac (?:was )?(?:not|isn't|wasn't) working|no ac|air.?con\\w* (?:was )?(?:not|broken)|too hot|very hot inside|stuffy|humid|freezing)\\b"),
        tone: "neg",
        concern: "Too hot, or air conditioning not working",
      },
      {
        re: R("\\b(cramped|tight (?:space|seating)|too close|packed|crowded|no space|little space|uncomfortable (?:seats?|chairs?|seating)|hard seats?)\\b"),
        tone: "neg",
        concern: "Cramped or uncomfortable seating",
      },
      { re: R("\\b(too dark|too bright|dull decor|dated decor|run.?down|shabby)\\b"), tone: "neg", concern: "Dated or poorly lit surroundings" },
      {
        re: R("\\b(cosy|cozy|calm|relaxed|relaxing|peaceful|romantic|comfortable|charming|pleasant|spacious|quiet|warm lighting|great music|nice music|great atmosphere|nice atmosphere|lovely decor|nice decor|beautiful decor|good ambien(?:ce|t))\\b"),
        tone: "pos",
      },
    ],
  },
  {
    key: "other",
    label: "Other",
    fallbackConcern: "General disappointment (no specific reason given)",
    topic: T("$^"),
    rules: [
      {
        re: R("\\b(rude|unfriendly|impolite|arrogant|uninterested|dismissive|unhelpful|didn't smile|did not smile|inattentive|disrespectful|unprofessional|ignored)\\b"),
        tone: "neg",
        concern: "Staff seemed rude or uninterested",
      },
      {
        re: R("\\bparking\\b[^.]{0,30}\\b(?:difficult|hard|nightmare|problem|issue|limited|impossible|bad)\\b|\\b(?:difficult|hard|limited|bad|no)\\s+parking\\b"),
        tone: "neg",
        concern: "Parking problems",
      },
      {
        re: R("\\b(?:reservation|booking|reserved|booked)\\b[^.]{0,40}\\b(?:lost|not noted|wasn't|not honou?red|cancel(?:led)?|mix.?up|problem|issue|no record)\\b|\\b(?:double.?booked|overbooked)\\b"),
        tone: "neg",
        concern: "Booking or reservation problems",
      },
      {
        re: R("\\b(?:delivery|takeaway|take.?away|parcel|packaging)\\b[^.]{0,40}\\b(?:late|cold|spill\\w*|wrong|missing|leak\\w*|damaged|poor|bad)\\b"),
        tone: "neg",
        concern: "Delivery or takeaway problems",
      },
      { re: R("\\b(wrong (?:order|dish|item)|missing (?:item|dish))\\b"), tone: "neg", concern: "Wrong or missing items" },
      {
        re: R("\\b(never (?:coming|going|again|return)|won't (?:be )?(?:coming|going|return)|will not (?:be )?(?:coming|return))\\b"),
        tone: "neg",
        concern: "Guests saying they won't return",
      },
      {
        re: R("\\b(friendly|polite|helpful|courteous|welcoming|attentive|went out of their way|manager came over|easy to book|parking (?:was )?(?:easy|ample|available)|easy parking)\\b"),
        tone: "pos",
      },
      {
        re: R("\\b(highly recommend|will (?:definitely |certainly )?(?:come|visit|be) (?:again|back)|must visit|worth a visit|come again)\\b"),
        tone: "pos",
      },
    ],
  },
];

// General opinion words, used only when a piece matched none of the phrase rules above.
const POS_WORDS = R("\\b(good|great|excellent|amazing|awesome|fantastic|wonderful|lovely|nice|perfect|best|love|loved|enjoyed|superb|brilliant|delightful|outstanding|recommend(?:ed)?|happy|pleasant|impressed)\\b");
const NEG_WORDS = R("\\b(bad|poor|terrible|awful|horrible|worst|disappointing|disappointed|disgusting|unacceptable|mediocre|pathetic|hate|hated|unhappy|upset|annoyed|annoying)\\b");

// "not", "never", "no" and friends, up to two words before a phrase, turn it around.
const NEGATOR_BEFORE = /\b(?:not|never|no|hardly|barely|without|wasn't|isn't|weren't|aren't|didn't|don't|doesn't|wouldn't|couldn't|cannot|can't)\b(?:\W+\w+){0,2}\W*$/i;

const negatedBefore = (lower: string, index: number) => NEGATOR_BEFORE.test(lower.slice(Math.max(0, index - 30), index));
const flip = (t: "pos" | "neg") => (t === "pos" ? "neg" : "pos");

/** Cuts a review into short pieces: sentences, lines, and clauses split at "but", "however" and similar. */
export function splitPieces(text: string): string[] {
  return text
    .replace(/[’‘]/g, "'")
    .replace(/([.!?])\s+/g, "$1\n")
    .split(/\n+|;|,?\s+(?:but|however|although|though|yet|whereas)\s+/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

interface Hit {
  pos: number;
  neg: number;
  strength: number; // phrase-rule matches (not general opinion words); used to pick examples
  concerns: Set<string>;
}

function readPiece(piece: string): Map<ThemeKey, Hit> {
  const lower = piece.toLowerCase();
  const hits = new Map<ThemeKey, Hit>();

  for (const def of THEMES) {
    const hit: Hit = { pos: 0, neg: 0, strength: 0, concerns: new Set() };
    let specificConcern = false;
    let needsFallback = false;
    for (const rule of def.rules) {
      if (rule.generic && specificConcern) continue;
      for (const m of lower.matchAll(rule.re)) {
        const flipped = negatedBefore(lower, m.index ?? 0);
        const tone = flipped ? flip(rule.tone) : rule.tone;
        if (tone === "pos") hit.pos++;
        else {
          hit.neg++;
          // A turned-around praise phrase ("not clean") only says "this was poor", so it is a fallback.
          if (flipped) needsFallback = true;
          else {
            hit.concerns.add(rule.concern ?? def.fallbackConcern);
            if (!rule.generic) specificConcern = true;
          }
        }
        if (!rule.generic) hit.strength++;
      }
    }
    // The broad label is only used when nothing more specific was found in the same piece.
    if (needsFallback && hit.concerns.size === 0) hit.concerns.add(def.fallbackConcern);
    if (hit.pos + hit.neg > 0) hits.set(def.key, hit);
  }

  // General opinion words ("lovely", "terrible") credit a theme that has no phrase match of its own, when a word
  // about that theme ("food", "music", "bill") appears in the same piece. With no theme word at all, they go to "other".
  let pos = 0;
  let neg = 0;
  for (const m of lower.matchAll(POS_WORDS)) {
    if (negatedBefore(lower, m.index ?? 0)) neg++;
    else pos++;
  }
  for (const m of lower.matchAll(NEG_WORDS)) {
    if (negatedBefore(lower, m.index ?? 0)) pos++;
    else neg++;
  }
  if (pos + neg === 0) return hits;
  const topical = THEMES.filter((d) => d.key !== "other" && !hits.has(d.key) && d.topic.test(lower));
  const targets = topical.length > 0 ? topical : hits.size === 0 ? THEMES.filter((d) => d.key === "other") : [];
  for (const def of targets) {
    hits.set(def.key, { pos, neg, strength: 0, concerns: neg > pos ? new Set([def.fallbackConcern]) : new Set() });
  }
  return hits;
}

const toneOf = (h: Hit): Tone => (h.pos > h.neg ? "positive" : h.neg > h.pos ? "negative" : "mixed");

export interface Example {
  text: string; // the review exactly as it appears in the file
  excerpt: string; // the part of it that mentions this theme
  rating: number | null;
  date: string | null;
  tone: Tone;
}

export interface Concern {
  label: string;
  reviews: number;
  /** Share of the reviews that mention this theme. */
  share: number;
}

export interface ThemeResult {
  key: ThemeKey;
  label: string;
  /** How many reviews mention this theme. */
  reviews: number;
  /** Share of all analysed reviews that mention it (0 to 1). */
  shareOfAll: number;
  positive: number;
  negative: number;
  mixed: number;
  /** null when no review mentions the theme. */
  sentiment: Tone | null;
  concerns: Concern[];
  examples: Example[];
}

export interface AnalysisResult {
  reviewCount: number;
  themes: ThemeResult[];
  /** Reviews where no theme (not even "other") was found. */
  reviewsWithNoTheme: number;
  ratedCount: number;
  averageRating: number | null;
  /** Reviews per star, rounding half stars up. */
  ratingCounts: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface Mention {
  index: number;
  tone: Tone;
  strength: number;
  excerpts: string[];
  concerns: Set<string>;
}

export function analyseReviews(reviews: ParsedReview[]): AnalysisResult {
  const mentions = new Map<ThemeKey, Mention[]>(THEMES.map((t) => [t.key, []]));
  let noTheme = 0;

  reviews.forEach((review, index) => {
    const perTheme = new Map<ThemeKey, { tones: Set<Tone>; strength: number; best: { piece: string; strength: number }; concerns: Set<string> }>();
    for (const piece of splitPieces(review.text)) {
      for (const [key, hit] of readPiece(piece)) {
        const cur = perTheme.get(key) ?? { tones: new Set<Tone>(), strength: 0, best: { piece, strength: -1 }, concerns: new Set<string>() };
        const tone = toneOf(hit);
        cur.tones.add(tone);
        cur.strength += hit.strength;
        if (hit.strength > cur.best.strength) cur.best = { piece, strength: hit.strength };
        if (tone !== "positive") hit.concerns.forEach((c) => cur.concerns.add(c));
        perTheme.set(key, cur);
      }
    }
    if (perTheme.size === 0) noTheme++;
    for (const [key, cur] of perTheme) {
      const tone: Tone =
        cur.tones.has("mixed") || (cur.tones.has("positive") && cur.tones.has("negative")) ? "mixed" : cur.tones.has("negative") ? "negative" : "positive";
      mentions.get(key)!.push({ index, tone, strength: cur.strength, excerpts: [cur.best.piece], concerns: cur.concerns });
    }
  });

  return aggregate(reviews, mentions, noTheme);
}

/**
 * Turns "which reviews mention which theme" into counts, shares, concerns and examples. Both the keyword rules and
 * the AI path end here, so every number is computed from the real reviews by this code.
 */
export function aggregate(reviews: ParsedReview[], mentions: Map<ThemeKey, Mention[]>, noTheme: number): AnalysisResult {
  const total = reviews.length;
  const themes: ThemeResult[] = THEMES.map((def) => {
    const list = mentions.get(def.key)!;
    const positive = list.filter((m) => m.tone === "positive").length;
    const negative = list.filter((m) => m.tone === "negative").length;
    const mixed = list.length - positive - negative;
    const sentiment: Tone | null =
      list.length === 0 ? null : negative / list.length >= SENTIMENT_SHARE ? "negative" : positive / list.length >= SENTIMENT_SHARE ? "positive" : "mixed";

    const counts = new Map<string, number>();
    for (const m of list) m.concerns.forEach((c) => counts.set(c, (counts.get(c) ?? 0) + 1));
    const concerns: Concern[] = [...counts]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, n]) => ({ label, reviews: n, share: n / list.length }));

    // Examples: reviews that lean the way the theme does, strongest phrase matches first, then shortest.
    const rank = (a: Mention, b: Mention) => b.strength - a.strength || reviews[a.index].text.length - reviews[b.index].text.length || a.index - b.index;
    const picked: Mention[] = [];
    // Prefer a review that says something different from the ones already chosen; repeat a wording only if nothing else is left.
    const seenWording = () => new Set(picked.map((m) => m.excerpts[0].toLowerCase()));
    const take = (tone: Tone) => {
      const rest = list.filter((m) => m.tone === tone && !picked.includes(m)).sort(rank);
      const fresh = rest.find((m) => !seenWording().has(m.excerpts[0].toLowerCase()));
      const next = fresh ?? rest[0];
      if (next) picked.push(next);
    };
    if (sentiment === "mixed") {
      take("negative");
      take("positive");
      take("mixed");
    }
    const lean: Tone = sentiment === "positive" ? "positive" : "negative";
    while (picked.length < Math.min(MAX_EXAMPLES, list.length)) {
      const before = picked.length;
      take(lean);
      if (picked.length === before) {
        const rest = list.filter((m) => !picked.includes(m)).sort(rank);
        const any = rest.find((m) => !seenWording().has(m.excerpts[0].toLowerCase())) ?? rest[0];
        if (!any) break;
        picked.push(any);
      }
    }
    const examples: Example[] = picked.slice(0, MAX_EXAMPLES).map((m) => ({
      text: reviews[m.index].text,
      excerpt: m.excerpts[0],
      rating: reviews[m.index].rating,
      date: reviews[m.index].date,
      tone: m.tone,
    }));

    return {
      key: def.key,
      label: def.label,
      reviews: list.length,
      shareOfAll: total ? list.length / total : 0,
      positive,
      negative,
      mixed,
      sentiment,
      concerns,
      examples,
    };
  });

  const ratings = reviews.map((r) => r.rating).filter((r): r is number => r !== null);
  const ratingCounts: AnalysisResult["ratingCounts"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of ratings) ratingCounts[Math.min(5, Math.max(1, Math.round(r))) as 1 | 2 | 3 | 4 | 5]++;

  return {
    reviewCount: total,
    themes,
    reviewsWithNoTheme: noTheme,
    ratedCount: ratings.length,
    averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
    ratingCounts,
  };
}

/** The concern labels each theme can show, so AI labels can only use wording that is already approved. */
export const THEME_VOCAB: Record<ThemeKey, { label: string; concerns: string[]; fallbackConcern: string }> = Object.fromEntries(
  THEMES.map((t) => [t.key, { label: t.label, concerns: [...new Set(t.rules.flatMap((r) => (r.concern ? [r.concern] : [])))], fallbackConcern: t.fallbackConcern }]),
) as Record<ThemeKey, { label: string; concerns: string[]; fallbackConcern: string }>;

export const THEME_KEYS: ThemeKey[] = THEMES.map((t) => t.key);
