// Checks the AI analysis helpers (lib/ai-analysis.ts) without calling Gemini: what is removed before sending,
// how Gemini's answer is validated, and that every count comes from our own code and the real reviews.
// Run it with:  node scripts/check-ai-analysis.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Node's TypeScript loader needs file extensions on imports, so run the checks on a scratch copy of the files.
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "ai-analysis-check-"));
for (const f of ["analysis", "ai-analysis", "priorities"]) {
  const src = fs.readFileSync(new URL(`../lib/${f}.ts`, import.meta.url), "utf8").replace(/from "\.\/(analysis|review-csv)"/g, 'from "./$1.ts"');
  fs.writeFileSync(path.join(dir, `${f}.ts`), src);
}
fs.writeFileSync(path.join(dir, "review-csv.ts"), "export {};\n");
const load = (f) => import(pathToFileURL(path.join(dir, `${f}.ts`)).href);
const ai = await load("ai-analysis");
const { buildPriorities } = await load("priorities");
const { analyseReviews } = await load("analysis");

let failures = 0;
const check = (name, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        got      ${JSON.stringify(actual)}`}`);
};
const throws = (name, fn, cls) => {
  let ok = false;
  try {
    fn();
  } catch (e) {
    ok = e instanceof cls;
  }
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
};

// ---------- What leaves the browser ----------
check("redact: email, phone and link are removed", ai.redactText("Mail me at raj.k@example.com or call +91 98765 43210, see https://x.com/p"), "Mail me at [email] or call [phone], see [link]");
check("redact: ordinary numbers are kept", ai.redactText("We waited 45 minutes for 3 dishes, bill was 1200"), "We waited 45 minutes for 3 dishes, bill was 1200");

const mk = (text, rating, reviewer = null) => ({ text, rating, date: "2026-10-01", reviewer });
const sent = ai.prepareForAi([mk("Priya Sharma was lovely, thanks Priya! Call 9876543210", 5, "Priya Sharma"), mk("x".repeat(2000), null, null)]);
check("send: reviewer names inside the text are blanked", sent[0].text, "[name] was lovely, thanks [name]! Call [phone]");
check("send: only text and rating are sent (no reviewer or date)", Object.keys(sent[0]).sort(), ["rating", "text"]);
check("send: long reviews are cut", sent[1].text.length, ai.MAX_REVIEW_CHARS);
check("send: the AI prompt never includes reviewer data", JSON.stringify(sent).includes("Sharma"), false);

// ---------- Checking Gemini's answer ----------
const good = JSON.stringify({
  reviews: [
    { id: 0, themes: [{ theme: "food", tone: "negative", concern: "Bland or lacking flavour" }] },
    { id: 1, themes: [{ theme: "food", tone: "positive", concern: "Bland or lacking flavour" }, { theme: "speed", tone: "negative", concern: "Made up concern" }] },
    { id: 2, themes: [] },
  ],
  count: 999,
  steps: { food: ["Check seasoning steps are written down and followed on every shift.", "Too short", "Fix it because the cook is lazy and ruined everything.", "Review 40 plates a day."], speed: [] },
});
const parsed = ai.parseAiLabels(good, 3);
check("parse: a valid answer is accepted", parsed.labels.map((l) => l.id), [0, 1, 2]);
check("parse: an unapproved concern wording becomes the theme's general concern", parsed.labels[1].themes[1], { theme: "speed", tone: "negative", concern: "Service described as slow" });
check("parse: a positive mention carries no concern", parsed.labels[1].themes[0], { theme: "food", tone: "positive", concern: null });
check("parse: steps with numbers, causes or too little text are dropped", parsed.steps, { food: ["Check seasoning steps are written down and followed on every shift."] });
check("parse: numbers in the answer (such as a made-up count) are not carried through", "count" in parsed, false);
check("parse: code fences around the JSON are tolerated", ai.parseAiLabels("```json\n" + good + "\n```", 3).labels.length, 3);
const dup = JSON.stringify({ reviews: [{ id: 0, themes: [{ theme: "food", tone: "positive" }, { theme: "food", tone: "negative", concern: "Stale or not fresh" }] }] });
check("parse: the same theme twice in one review becomes mixed", ai.parseAiLabels(dup, 1).labels[0].themes, [{ theme: "food", tone: "mixed", concern: "Stale or not fresh" }]);
throws("parse: not JSON is rejected", () => ai.parseAiLabels("Sure! Here are the themes", 3), ai.AiFormatError);
throws("parse: a missing review is rejected", () => ai.parseAiLabels(good, 4), ai.AiFormatError);
throws("parse: an id outside the batch is rejected", () => ai.parseAiLabels(JSON.stringify({ reviews: [{ id: 5, themes: [] }] }), 1), ai.AiFormatError);
throws("parse: a repeated id is rejected", () => ai.parseAiLabels(JSON.stringify({ reviews: [{ id: 0, themes: [] }, { id: 0, themes: [] }] }), 2), ai.AiFormatError);
throws("parse: an unknown theme is rejected", () => ai.parseAiLabels(JSON.stringify({ reviews: [{ id: 0, themes: [{ theme: "parking", tone: "positive" }] }] }), 1), ai.AiFormatError);
throws("parse: an unknown tone is rejected", () => ai.parseAiLabels(JSON.stringify({ reviews: [{ id: 0, themes: [{ theme: "food", tone: "great" }] }] }), 1), ai.AiFormatError);
throws("parse: the wrong shape is rejected", () => ai.parseAiLabels(JSON.stringify({ themes: [] }), 1), ai.AiFormatError);

// ---------- Counting is ours ----------
const reviews = [
  mk("The soup was bland and cold", 2),
  mk("Great food, but we waited ages", 3),
  mk("Lovely evening", 5),
  mk("Table was sticky", 1),
  mk("Tasty biryani", 4),
  mk("Dirty washroom", 1),
  mk("Cutlery was stained", 2),
];
const labels = ai.parseAiLabels(
  JSON.stringify({
    reviews: [
      { id: 0, themes: [{ theme: "food", tone: "negative", concern: "Bland or lacking flavour" }] },
      { id: 1, themes: [{ theme: "food", tone: "positive" }, { theme: "speed", tone: "negative", concern: "Long wait for food or service" }] },
      { id: 2, themes: [{ theme: "other", tone: "positive" }] },
      { id: 3, themes: [{ theme: "clean", tone: "negative", concern: "Dirty tables or cutlery" }] },
      { id: 4, themes: [{ theme: "food", tone: "positive" }] },
      { id: 5, themes: [{ theme: "clean", tone: "negative", concern: "Unclean washrooms" }] },
      { id: 6, themes: [{ theme: "clean", tone: "negative", concern: "Dirty tables or cutlery" }] },
    ],
    steps: { clean: ["Consider a short table-reset checklist between guests, with a sign-off sheet."], summary: ["There were 500 complaints"] },
  }),
  7,
);
const res = ai.analysisFromLabels(reviews, labels);
const theme = (k) => res.themes.find((t) => t.key === k);
const tally = (t) => [t.reviews, t.positive, t.negative, t.mixed, t.sentiment];
check("counts: review total comes from the real reviews", res.reviewCount, 7);
check("counts: food = 3 reviews (2 positive, 1 negative) -> positive", tally(theme("food")), [3, 2, 1, 0, "positive"]);
check("counts: cleanliness = 3 negative", tally(theme("clean")), [3, 0, 3, 0, "negative"]);
check("counts: cleanliness concerns are counted by us", theme("clean").concerns.map((c) => [c.label, c.reviews]), [["Dirty tables or cutlery", 2], ["Unclean washrooms", 1]]);
check("counts: share of all reviews is reviews / total", Math.round(theme("clean").shareOfAll * 1000), 429);
check("counts: average rating comes from the file's ratings", Math.round(res.averageRating * 100), 257);
check("counts: rating distribution comes from the file", res.ratingCounts, { 1: 2, 2: 2, 3: 1, 4: 1, 5: 1 });
check("counts: examples are real review text from the file", theme("clean").examples.every((e) => reviews.some((r) => r.text === e.text)), true);
check("counts: a review the AI gave no theme is counted as having none", ai.analysisFromLabels([mk("ok", 3)], { labels: [{ id: 0, themes: [] }], steps: {} }).reviewsWithNoTheme, 1);

// ---------- Priorities and next steps ----------
const plain = buildPriorities(res);
const withAi = buildPriorities(res, labels.steps);
check("priorities: the ranking is the same with or without AI steps", withAi.priorities.map((p) => [p.key, p.concernedReviews]), plain.priorities.map((p) => [p.key, p.concernedReviews]));
check("priorities: cleanliness is the top priority from the counts", plain.priorities[0].key, "clean");
check("priorities: AI steps replace the ready-made ones and the records check stays last", [withAi.priorities[0].steps.length, withAi.priorities[0].steps[0], withAi.priorities[0].steps.at(-1).startsWith("Before changing anything")], [2, "Consider a short table-reset checklist between guests, with a sign-off sheet.", true]);
check("priorities: a made-up theme in the steps is ignored", Object.keys(labels.steps), ["clean"]);

// ---------- Batches ----------
const m = ai.mergeBatches(
  [{ labels: [{ id: 0, themes: [] }, { id: 1, themes: [] }], steps: { food: ["Check seasoning steps on every shift, please."] } }, { labels: [{ id: 0, themes: [] }], steps: { food: ["Check seasoning steps on every shift, please.", "Consider heated plates for dishes that cool quickly."] } }],
  [0, 100],
);
check("batches: ids are shifted back to positions in the full list", m.labels.map((l) => l.id), [0, 1, 100]);
check("batches: steps are merged without repeats", m.steps.food.length, 2);

// ---------- Same shape as the keyword rules ----------
check("shape: AI result has the same fields as the keyword result", Object.keys(res).sort(), Object.keys(analyseReviews(reviews)).sort());

fs.rmSync(dir, { recursive: true, force: true });
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
