import type { AnalysisResult, Concern, ThemeKey } from "./analysis";

/**
 * Picks up to three areas to look at first, from the theme counts. It ranks by how many reviews voice a concern,
 * and it never says why something happens: the next steps are suggestions for checking and improving, written in
 * advance, not conclusions drawn from the reviews.
 */

/** A theme needs at least this many reviews voicing a concern before it can be called a priority. */
export const MIN_CONCERNED_REVIEWS = 3;
/** With fewer reviews than this, everything is only an early signal. */
export const SMALL_SAMPLE = 20;
export const MAX_PRIORITIES = 3;

export interface Priority {
  rank: number;
  key: ThemeKey;
  label: string;
  /** Reviews that voice a concern about this theme (negative, or positive and negative). */
  concernedReviews: number;
  /** Share of all analysed reviews (0 to 1). */
  shareOfAll: number;
  /** All reviews mentioning the theme, and how many of those were positive. */
  themeReviews: number;
  positiveReviews: number;
  /** The most mentioned concerns, at most three. */
  concerns: Concern[];
  /** True when the first concern was mentioned by at least three reviews. */
  frequent: boolean;
  steps: string[];
}

export interface PrioritiesResult {
  priorities: Priority[];
  totalReviews: number;
  /** Few reviews overall, so patterns are tentative. */
  smallSample: boolean;
}

// Suggestions are phrased as things to check or try. They are not findings about this restaurant.
const STEPS: Record<string, string[]> = {
  "Food served cold or lukewarm": [
    "Time a few orders from the kitchen pass to the table at busy hours and note where plates wait.",
    "Consider heated plates or covers for dishes that cool quickly, and ask servers to run food as soon as it is plated.",
  ],
  "Bland or lacking flavour": [
    "Taste the dishes customers name alongside the recipe card, and check that seasoning steps are written down and followed on every shift.",
    "Offer salt, chilli or sauces at the table so guests can adjust.",
  ],
  "Too salty, oily or spicy": [
    "Check the quantities in the recipes for the dishes named, and that every cook follows the same measures.",
    "Consider offering spice-level options and having servers confirm the choice.",
  ],
  "Undercooked, overcooked or dry": [
    "Add a quick doneness or temperature check to the kitchen routine for the dishes named.",
    "On busy shifts, have a second person look at plates at the pass.",
  ],
  "Stale or not fresh": [
    "Check storage, labelling and first-in-first-out rotation for the ingredients used in the dishes named.",
    "Review how long prepared items sit before they are served.",
  ],
  "Food described as poor": ["Read the example reviews to see which dishes come up, then taste those dishes yourself during service."],

  "Long wait for food or service": [
    "Note order-to-table times for a week at your busiest hours, and compare them with what customers describe.",
    "Check whether one station (for example the grill, the tandoor or billing) is where orders queue up.",
    "When it is busy, consider telling guests an honest wait time when they order.",
  ],
  "Long wait for a table": [
    "Review how bookings and walk-ins are seated at peak times, and consider a waitlist with an estimated wait.",
    "Check that booked tables are held and released on time.",
  ],
  "Orders forgotten or slow to be taken": [
    "Check that every table is greeted within a few minutes and that each section has a clear owner.",
    "Consider a simple order checklist or handheld ordering to avoid lost orders.",
  ],
  "Slow bill or payment": ["Consider offering the bill earlier, or payment at the table, when guests look ready to leave."],
  "Service described as slow": ["If your system records order and serving times, look at when delays happen across the day and week."],

  "Dirty tables or cutlery": [
    "Consider a short table-reset checklist (wipe, check, set) between guests.",
    "Check the dishwashing routine, and look over cutlery and glasses before tables are laid.",
  ],
  "Unclean washrooms": ["Consider a washroom check with a sign-off sheet, for example every hour at busy times."],
  "Flies, insects or pests": ["Review your pest-control schedule and how doors and waste are handled, and speak to your pest-control provider."],
  "Hair or foreign objects in food": ["Review hair-covering and kitchen hygiene rules, and consider a final visual check at the pass."],
  "Guests feeling unwell after eating": [
    "Take each mention seriously: check storage temperatures and food handling, and consider getting food-safety advice. A mention alone does not show what caused it.",
  ],
  "Place described as dirty or unhygienic": ["Walk through the restaurant as a guest would (entrance, table, washroom) with a short checklist."],
  "Cleanliness described as poor": ["Walk through the restaurant as a guest would (entrance, table, washroom) with a short checklist."],

  "Prices feel too high": [
    "Compare your prices with similar nearby restaurants for the dishes customers mention.",
    "Check whether the menu makes the value clear, for example through descriptions and portion sizes.",
  ],
  "Bill higher than expected": ["Make service charges and taxes clear on the menu, and consider having servers mention extras before ordering."],
  "Portions feel small for the price": ["Compare portion sizes with what the menu and photos suggest, and consider stating portion sizes on the menu."],
  "Poor value for money": ["Look at your best-value dishes and combos, and consider featuring them."],
  "Prices described as too high": ["Read the example reviews to see which dishes or items customers connect with price."],

  "Too noisy or loud": [
    "Check the music volume at busy hours, and consider a maximum level that comes down when the room is full.",
    "Soft furnishings can reduce echo in a busy room.",
  ],
  "Too hot, or air conditioning not working": ["Consider servicing the cooling before the hot season, and check table temperatures at peak times."],
  "Cramped or uncomfortable seating": ["Check the spacing between tables and the comfort of the chairs, and consider rearranging or removing a table."],
  "Dated or poorly lit surroundings": ["Check the lighting at dinner time. Small changes such as bulbs or dimmers can help."],
  "Ambience described as unpleasant": ["Sit at a few tables yourself at peak time and note what you notice."],
};

const CHECK_STEP = "Before changing anything, compare the example reviews with your own records, such as order times or complaints you have noted.";

/**
 * `aiSteps` (optional) are already-checked suggestions from the AI, by theme. When a theme has some they replace the
 * ready-made ones. The ranking and every count still come only from `analysis`.
 */
export function buildPriorities(analysis: AnalysisResult, aiSteps?: Partial<Record<ThemeKey, string[]>>): PrioritiesResult {
  const total = analysis.reviewCount;
  const candidates = analysis.themes
    // "Other" is a catch-all, so it is shown on its own card but not ranked.
    .filter((t) => t.key !== "other")
    .map((t) => ({ theme: t, concerned: t.negative + t.mixed }))
    .filter((c) => c.concerned >= MIN_CONCERNED_REVIEWS)
    .sort(
      (a, b) =>
        b.concerned - a.concerned ||
        b.concerned / b.theme.reviews - a.concerned / a.theme.reviews ||
        analysis.themes.indexOf(a.theme) - analysis.themes.indexOf(b.theme),
    )
    .slice(0, MAX_PRIORITIES);

  const priorities: Priority[] = candidates.map(({ theme, concerned }, i) => {
    const concerns = theme.concerns.slice(0, 3);
    const steps: string[] = [];
    const add = (s: string | undefined) => {
      if (s && !steps.includes(s)) steps.push(s);
    };
    // One suggestion for each of the top concerns, then any further ones for the first concern, then the safety check.
    for (const c of concerns.slice(0, 2)) add(STEPS[c.label]?.[0]);
    for (const s of STEPS[concerns[0]?.label] ?? []) add(s);
    if (steps.length === 0) add(STEPS[theme.key === "food" ? "Food described as poor" : theme.key === "speed" ? "Service described as slow" : theme.key === "clean" ? "Cleanliness described as poor" : theme.key === "price" ? "Prices described as too high" : "Ambience described as unpleasant"]?.[0]);
    // At most three suggestions, then the reminder to compare with your own records, which is never cut.
    steps.splice(3);
    add(CHECK_STEP);
    const suggested = aiSteps?.[theme.key];
    if (suggested && suggested.length > 0) steps.splice(0, steps.length, ...suggested.slice(0, 3), CHECK_STEP);
    return {
      rank: i + 1,
      key: theme.key,
      label: theme.label,
      concernedReviews: concerned,
      shareOfAll: total ? concerned / total : 0,
      themeReviews: theme.reviews,
      positiveReviews: theme.positive,
      concerns,
      frequent: (concerns[0]?.reviews ?? 0) >= 3,
      steps,
    };
  });

  return { priorities, totalReviews: total, smallSample: total < SMALL_SAMPLE };
}
