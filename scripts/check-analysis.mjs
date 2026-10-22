// Checks lib/analysis.ts against 14 short reviews whose correct answers were worked out by hand first,
// then sanity-checks the built-in sample file against independent plain-text counts.
// Run it with:  node scripts/check-analysis.mjs
import fs from "node:fs";
import { analyseReviews } from "../lib/analysis.ts";
import { buildPriorities } from "../lib/priorities.ts";

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(actual)}`}`);
};

// ---------- Part 1: fourteen hand-checked reviews ----------
const r = (text, rating) => ({ text, rating, date: null, reviewer: null });
const reviews = [
  r("The food was cold and tasteless. Service was very slow.", 2), //                       R1
  r("Loved the biryani, it was fresh and tasty. Staff were friendly and polite.", 5), //    R2
  r("Delicious food but we waited 50 minutes for a table.", 3), //                          R3
  r("Prices are reasonable and the portions are generous.", 4), //                          R4
  r("The food was not cold and not bad at all.", 4), //                                     R5
  r("The washroom was dirty and the table was sticky.", 1), //                              R6
  r("Way too noisy and the AC was not working.", 2), //                                     R7
  r("Overpriced for what you get.", 2), //                                                  R8
  r("Highly recommend, will definitely come again.", 5), //                                 R9
  r("Great place. Nothing to complain about.", 5), //                                       R10
  r("Parking was a nightmare and the staff seemed rude.", 1), //                            R11
  r("We visited on Friday evening with family.", null), //                                  R12
  r("The staff was rude but the food was delicious and the music was too loud.", 3), //     R13
  r("The pasta was delicious. The dessert was bland.", 3), //                               R14
];
const a = analyseReviews(reviews);
const t = (key) => a.themes.find((x) => x.key === key);
const tally = (x) => [x.reviews, x.positive, x.negative, x.mixed, x.sentiment];
const concerns = (x) => x.concerns.map((c) => [c.label, c.reviews]);

check("14 reviews analysed", a.reviewCount, 14);
check("food: 6 reviews (4 positive, 1 negative, 1 mixed) -> positive", tally(t("food")), [6, 4, 1, 1, "positive"]);
check("food concerns", concerns(t("food")), [["Bland or lacking flavour", 2], ["Food served cold or lukewarm", 1]]);
check("speed: 2 reviews, both negative", tally(t("speed")), [2, 0, 2, 0, "negative"]);
check("speed concerns", concerns(t("speed")), [["Long wait for a table", 1], ["Long wait for food or service", 1]]);
check("cleanliness: 1 negative review", tally(t("clean")), [1, 0, 1, 0, "negative"]);
check("cleanliness concerns", concerns(t("clean")), [["Dirty tables or cutlery", 1], ["Unclean washrooms", 1]]);
check("pricing: 1 positive + 1 negative -> mixed", tally(t("price")), [2, 1, 1, 0, "mixed"]);
check("pricing concerns", concerns(t("price")), [["Prices feel too high", 1]]);
check("ambience: 2 negative reviews", tally(t("ambience")), [2, 0, 2, 0, "negative"]);
check("ambience concerns", concerns(t("ambience")), [["Too noisy or loud", 2], ["Too hot, or air conditioning not working", 1]]);
check("other: 3 positive, 2 negative (60% positive) -> positive", tally(t("other")), [5, 3, 2, 0, "positive"]);
check("other concerns", concerns(t("other")), [["Staff seemed rude or uninterested", 2], ["Parking problems", 1]]);
check("one review mentions nothing (R12)", a.reviewsWithNoTheme, 1);
check("13 reviews have a rating", a.ratedCount, 13);
check("average rating is 40/13", a.averageRating, 40 / 13);
check("stars 1..5", [1, 2, 3, 4, 5].map((s) => a.ratingCounts[s]), [2, 3, 3, 2, 3]);
check("share of all reviews (food 6/14)", t("food").shareOfAll, 6 / 14);
check("negation: 'not cold and not bad' creates no food concern", reviews[4] && analyseReviews([reviews[4]]).themes.find((x) => x.key === "food").concerns, []);
const food = t("food");
check("food examples: at most 3, strongest match first", [food.examples.length <= 3, food.examples[0].text], [true, reviews[1].text]);
check("every example is a real review from the input", a.themes.every((x) => x.examples.every((e) => reviews.some((rv) => rv.text === e.text))), true);
check("a theme nobody mentions is reported as null, not guessed", analyseReviews([r("Great biryani and fresh naan today", 5)]).themes.find((x) => x.key === "speed").sentiment, null);

check("'worth the wait' is not read as praise for prices", analyseReviews([r("The waiter was slow but the biryani was worth the wait.", null)]).themes.find((x) => x.key === "price").reviews, 0);
check("'cold coffee ... great' counts as positive food, not a cold-food concern", (() => { const f = analyseReviews([r("Tried the cold coffee, it was great.", null)]).themes.find((x) => x.key === "food"); return [f.sentiment, f.concerns.length]; })(), ["positive", 0]);

const both = analyseReviews([r("Lovely food and a calm atmosphere.", 5)]);
check("a general opinion word still credits a theme with no phrase of its own ('lovely food' + 'calm atmosphere')", ["food", "ambience"].map((k) => both.themes.find((x) => x.key === k).sentiment), ["positive", "positive"]);
const dull = analyseReviews([r("The food was cold and the music was nice.", 3)]);
check("one piece can be negative for one theme and positive for another", ["food", "ambience"].map((k) => dull.themes.find((x) => x.key === k).sentiment), ["negative", "positive"]);
const speedExamples = analyseReviews([r("Service was very slow.", 2), r("Service was very slow.", 2), r("We waited an hour for our food.", 2)]).themes.find((x) => x.key === "speed").examples;
check("examples prefer a different wording over repeating one", speedExamples.slice(0, 2).map((e) => e.excerpt), ["Service was very slow.", "We waited an hour for our food."]);

// ---------- Part 2: the sample file against independent counts ----------
const lines = fs.readFileSync(new URL("../public/sample-reviews.csv", import.meta.url), "utf8").trim().split(/\r?\n/).slice(1);
const rows = lines.map((l) => {
  const m = /^(?:"((?:[^"]|"")*)"|([^,]*)),(\d),([^,]*),(.*)$/.exec(l);
  return { text: (m[1] ?? m[2]).replace(/""/g, '"'), rating: Number(m[3]), date: m[4], reviewer: m[5] };
});
const s = analyseReviews(rows);
const st = (key) => s.themes.find((x) => x.key === key);
const has = (...phrases) => rows.filter((rw) => phrases.some((p) => rw.text.includes(p))).length;
const concernCount = (key, label) => st(key).concerns.find((c) => c.label === label)?.reviews ?? 0;

check("sample: 150 reviews", s.reviewCount, 150);
check("sample: every theme's tallies add up", s.themes.every((x) => x.positive + x.negative + x.mixed === x.reviews), true);
check("sample: no theme counts more reviews than exist", s.themes.every((x) => x.reviews <= 150), true);
check("sample: 'found a hair' sentences match the concern count", concernCount("clean", "Hair or foreign objects in food"), has("Found a hair in my food"));
check("sample: AC sentences match the concern count", concernCount("ambience", "Too hot, or air conditioning not working"), has("The AC was not working"));
check("sample: bill-shock sentences match the concern count", concernCount("price", "Bill higher than expected"), has("The bill was much higher than we expected"));
check("sample: 'too high' price sentences match the concern count", concernCount("price", "Prices feel too high"), has("Overpriced for the portion size", "Too expensive for what you actually get", "Prices have gone up but the quality has not"));
check("sample: 'sticky table' sentences match the concern count", concernCount("clean", "Dirty tables or cutlery"), has("The table was sticky", "The cutlery had stains"));
check("sample: 'cold food' sentences match the concern count", concernCount("food", "Food served cold or lukewarm"), has("was cold when it reached our table"));
check("sample: reviews with no theme", s.reviewsWithNoTheme, rows.filter((rw) => rw.text === "Hope they fix this.").length);

// ---------- Part 2b: the five-review quick sample ----------
const quick = fs.readFileSync(new URL("../public/sample-reviews-5.csv", import.meta.url), "utf8").trim().split(/\r?\n/).slice(1).map((l) => {
  const m = /^(?:"((?:[^"]|"")*)"|([^,]*)),(\d),([^,]*),(.*)$/.exec(l);
  return { text: (m[1] ?? m[2]).replace(/""/g, '"'), rating: Number(m[3]), date: m[4], reviewer: m[5] };
});
const q = analyseReviews(quick);
const qt = (key) => q.themes.find((x) => x.key === key);
check("quick sample: five reviews, all clearly labelled as sample reviewers", [quick.length, quick.every((r) => r.reviewer.startsWith("Sample reviewer"))], [5, true]);
check("quick sample: slow service in 3 of 5 reviews, all negative", [qt("speed").reviews, qt("speed").negative, qt("speed").sentiment], [3, 3, "negative"]);
check("quick sample: food 4 mentions (3 positive, 1 negative)", [qt("food").reviews, qt("food").positive, qt("food").negative], [4, 3, 1]);
check("quick sample: pricing 1 negative, ambience 1 positive", [qt("price").negative, qt("ambience").positive], [1, 1]);
check("quick sample: average rating is 13/5", q.averageRating, 13 / 5);
check("quick sample: exactly one priority, Service speed, from 3 reviews", buildPriorities(q).priorities.map((x) => [x.label, x.concernedReviews]), [["Service speed", 3]]);

// ---------- Part 3: priorities ----------
// 19 reviews built so the answer is clear: 5 slow service, 4 cold food, 3 overpriced (+2 value praise), 3 noisy, 2 sticky tables.
const many = (n, text, rating) => Array.from({ length: n }, (_, i) => r(i ? `${text} (visit ${i + 1})` : text, rating));
const set = [
  ...many(5, "Service was very slow tonight.", 2),
  ...many(4, "The food was cold.", 2),
  ...many(3, "Overpriced for what you get.", 2),
  ...many(2, "Good value for money.", 5),
  ...many(3, "Way too noisy.", 2),
  ...many(2, "The table was sticky.", 2),
];
const p = buildPriorities(analyseReviews(set));
check("priorities: 19 reviews is a small sample", [p.totalReviews, p.smallSample], [19, true]);
check("priorities: ranked by reviews voicing a concern (slow service 5, cold food 4, noise 3)", p.priorities.map((x) => [x.label, x.concernedReviews]), [["Service speed", 5], ["Food quality", 4], ["Ambience", 3]]);
check("priorities: pricing ties noise on 3 but is only 3 of 5 negative, so noise wins the third place", p.priorities.some((x) => x.key === "price"), false);
check("priorities: cleanliness (2 reviews) is below the minimum of 3", p.priorities.some((x) => x.key === "clean"), false);
check("priorities: share of all reviews is a real fraction (5/19)", p.priorities[0].shareOfAll, 5 / 19);
check("priorities: top concern and its count come from the data", [p.priorities[0].concerns[0].label, p.priorities[0].concerns[0].reviews], ["Long wait for food or service", 5]);
check("priorities: every priority has next steps ending with the 'check your own records' step", p.priorities.every((x) => x.steps.length >= 2 && x.steps[x.steps.length - 1].startsWith("Before changing anything")), true);
const FORBIDDEN = /\b(caus(?:e|es|ed|ing)|because|proves?|proof|fake|root cause|reason why)\b/i;
check("priorities: wording never claims a cause, proof or 'fake' (steps and labels)", p.priorities.flatMap((x) => [...x.steps.slice(0, -1), x.label, ...x.concerns.map((c) => c.label)]).filter((t) => FORBIDDEN.test(t) && !t.includes("does not show what caused it")), []);
check("priorities: too few concerns gives no priorities, not invented ones", buildPriorities(analyseReviews([r("Service was very slow tonight.", 2), r("The food was cold.", 2), r("Lovely food and nice staff.", 5)])).priorities, []);
check("priorities: on the sample file too, every priority ends with the 'check your own records' step and has at most 4 steps", buildPriorities(s).priorities.every((x) => x.steps.length <= 4 && x.steps[x.steps.length - 1].startsWith("Before changing anything")), true);
check("priorities: sample file gives three priorities, each with enough reviews", (() => { const sp = buildPriorities(s); return [sp.priorities.length, sp.priorities.every((x) => x.concernedReviews >= 3)]; })(), [3, true]);

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
