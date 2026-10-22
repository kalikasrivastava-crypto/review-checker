# Review Checker

Check a suspicious negative Google review against your own order records and opening hours, get a risk level with plain reasons, and a calm reply draft you can edit, approve and copy.

## Job to be done

> When a suspicious negative Google review appears on my restaurant's listing, I want to see quickly whether its claims match my own records and have a calm reply ready, so I can respond within 24–48 hours without losing an evening to investigating.

**User:** the owner-operator of a single-location independent restaurant who answers Google reviews personally, often mid-shift.

## The 3 tests

1. **Speed.** Pick a seeded review (or paste one with its date and stars) and click **Check review**. Within 10 seconds a risk level (low, medium or high) appears with 2–3 plain-language reasons.
2. **Evidence and reply.** Below the score, each factual claim is marked **match**, **mismatch** or **no data** against the sample orders and opening hours, and a calm reply draft is ready to edit and approve. A claim with nothing to check against always shows "no data", never "mismatch".
3. **Bad input.** Empty text, text too short to be a review, text that isn't a review, or the AI failing or timing out shows a clear message instead of a score, and the app doesn't crash.

**Status:** all 3 tests pass in live runs on a Gemini free-tier key (`gemini-3.6-flash`).
- **Test 1:** all 8 seeded reviews showed a risk level and reasons in 2.0–3.3 seconds. The reply draft loads separately, 4–6 seconds later.
- **Test 2:** "table of 10 on Friday" shows mismatch; the three genuine complaints show match or no data and are rated low; both burst reviews mention the burst; all 8 replies are 64–72 words and break none of the reply rules.
- **Test 3:** empty text, too-short text, a recipe ("This doesn't look like a review."), a missing or invalid key ("The AI service isn't set up.") and days with no orders ("no data") all show a clear message and don't crash. Invalid AI output is rejected by the answer check and retried once.

Small known flaws: a claim can occasionally be listed twice (for example "appetizers" next to the wait-time claim, harmless, shown as "no data"), and free-tier rate limits can show "The AI is busy right now" if you click reviews quickly. See *Known limits*.

## Current workflow → future workflow

| | Today (without the app) | With the app |
|---|---|---|
| Notice | A negative review shows up, often during service. | Same. |
| Investigate | Dig through the till and booking records for that day, by hand, for an evening. | Click the review, click **Check review**: each claim is compared to orders and hours automatically. |
| Decide | Gut feeling about whether it's genuine. | A risk level with reasons, and every claim marked match, mismatch or no data. |
| Reply | Write from scratch, tired and annoyed, sometimes too defensive. | A calm draft is ready to edit. |
| Post | Paste into Google. | Approve, Copy, paste into Google (still done by hand). |

**Later versions (out of scope now):** posting replies through the Google Business Profile API, pulling new reviews on a schedule (n8n could come back for this), WhatsApp or email alerts, drafting Google reports and the 5-day re-check, multiple locations, login and billing.

## Architecture: Input → AI → Logic → Action → Output

| Stage | What happens | AI or code |
|---|---|---|
| **Input** | Pick one of 8 seeded reviews (`data/reviews.json`) or paste text plus date and star rating. | Code: `app/page.tsx`, `components/ReviewList.tsx` |
| Input check | Empty, too short, or missing rating/date is rejected with a message. The AI is not called. | Code: `lib/validate.ts` |
| **AI call 1** | Reads the review and returns whether it is a review, a risk level, up to 3 reasons, and each checkable claim (party size, weekday, time). | **AI:** `app/api/check/route.ts` |
| **Logic** | Looks up each claim in `data/orders.csv` and `data/hours.json`, counts bursts of one-star reviews (3+ in 24 hours), and settles the final risk. Evidence can only raise the AI's risk, never lower it, and "no data" changes nothing. | Code: `lib/checks.ts` |
| **AI call 2** | Drafts a public reply under 80 words from the review plus the evidence. | **AI:** `app/api/reply/route.ts` |
| **Action** | The owner edits the draft and clicks **Approve**. | **Human** |
| **Output** | Score card, evidence table, editable reply. After Approve: "Approved – ready to paste into Google" and a Copy button. Nothing is posted to Google. | Code: `components/` |

Prompts live in `lib/prompts.ts`. The Gemini call is in `lib/ai.ts`. Shared types are in `lib/types.ts`.

## Where AI is used, and what stays human

**AI is used twice, and only where a fixed rule can't do the job:**
- **Reading the review.** People describe the same fact in endless ways ("table of 10", "ten of us", "our big group on Friday night"). A keyword rule would miss most of them. The AI turns the text into structured claims; plain code then does the exact lookup.
- **Writing the reply.** The reply has to address this review's specific points without sounding defensive. A template can't do that.

**Everything else is plain code on purpose:** input checks, record lookups, the burst rule, the final risk rule and the whole screen. These are exact yes/no logic, so they behave the same way every time, they cost nothing, and the owner can read and trust them.

**What stays human:** choosing the review, editing the reply, approving it, copying it and posting it on Google. The risk level is a hint, not a verdict.

## Why these tools

- **Next.js (one app):** the screen and the server routes live together, so there is one thing to build and run. The API key stays on the server, in `app/api/`, and never reaches the browser.
- **Plain TypeScript functions instead of n8n:** the two jobs n8n would do (claim checks and the burst rule) are a few small functions. n8n can return later for scheduled pulls from Google.
- **Seeded files instead of a database:** 8 reviews, a week of made-up orders and the opening hours are enough for the 3 tests and easy to read.
- **Gemini (`gemini-3.6-flash` by default):** the project owner uses a Gemini key. The call is one small function in `lib/ai.ts`, so swapping providers means changing only that file. Set `GEMINI_MODEL` in `.env.local` to try another model.
- **No UI library:** one plain CSS file.

## Failure cases (the screen shows a message, never a crash)

| Situation | What the screen says |
|---|---|
| Empty text | "Paste a review first." |
| Too short | "That's too short to check." |
| Missing or invalid rating or date | "Add the review's star rating (1 to 5)." / "Add the date the review was posted." |
| Text isn't a review (recipe, random text) | "This doesn't look like a review." No score. |
| API key missing, placeholder or rejected | "The AI service isn't set up." (the key's name is never shown) |
| AI rate-limited or overloaded | "The AI is busy right now. Wait a minute and try again." (one automatic retry first) |
| AI times out (9 seconds) | "The AI took too long to answer. Try again." |
| AI answer isn't valid JSON | One automatic retry, then "Couldn't read the AI's answer. Try again." |
| Reply can't be drafted | The score and evidence stay; the reply box shows "Couldn't draft a reply" with a Try again button. |
| A claim with nothing to check against (e.g. a day with no orders on file) | Shown as "no data", never "mismatch", and the risk is unchanged. |

**What the AI could get wrong, and how the screen shows it:** the evidence table quotes the review's own words next to each claim, so a misread or missed claim is visible. When records or a burst raise the risk, the card says "The AI rated this X; your records and recent reviews raised it to Y". The reply is checked by code for length and for words like refund, records or lying, and a warning is shown instead of hiding a bad draft. A banner reads "AI-assisted – check before posting."

## Known limits

- **Free-tier Gemini keys are rate-limited** (a few requests a minute) and sometimes slow or overloaded. Each review uses 2 AI calls, so clicking quickly can hit "The AI is busy". A paid key avoids this. Speed against the 10-second goal depends on Gemini's load at the time.
- A "mismatch" means no matching order was found in the sample records. A big group split across several tables could look like a false mismatch.
- All data is made up. The sample orders cover 13–18 October 2026 (Mondays and Wednesdays have no orders on purpose, to exercise "no data").

## Run it locally

You need Node.js 20 or newer (LTS) and a Gemini API key from https://aistudio.google.com/apikey.

```bash
git clone <this repo's URL>
cd review-checker
npm install
cp .env.example .env.local
```

Open `.env.local` and paste your key after `GEMINI_API_KEY=` (no spaces or quotes). Then:

```bash
npm run dev
```

Open http://localhost:3000, click a review in the list, then click **Check review**. Restart `npm run dev` after changing `.env.local`.

`.env.local` is ignored by git. Never commit your key.

## Project layout

```
app/page.tsx              the one screen
app/api/check/route.ts    validate, AI call 1, run the checks
app/api/reply/route.ts    AI call 2, reply draft
components/               ReviewList, ScoreCard, EvidenceTable, ReplyEditor
lib/                      ai, prompts, validate, checks, types
data/                     reviews.json, orders.csv, hours.json
```
