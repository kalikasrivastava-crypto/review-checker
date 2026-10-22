// Checks lib/analysis.ts against 14 short reviews whose correct answers were worked out by hand first,
// then sanity-checks the built-in sample file against independent plain-text counts.
// Run it with:  node scripts/check-analysis.mjs
import fs from "node:fs";
import { analyseReviews } from "../lib/analysis.ts";

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

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
