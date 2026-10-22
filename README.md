# Review Checker

Check a suspicious negative Google review against your own order records and opening hours, get a risk level with plain reasons, and a calm reply draft you can edit, approve and copy.

## Job to be done

> When I receive a suspicious negative Google review, I want to understand whether it may be fake and how to respond, so I can protect my restaurant's reputation without spending hours investigating it.

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

**Current workflow**
1. Notice a suspicious negative review on Google.
2. Compare the review with what happened at the restaurant.
3. Check available evidence, such as order records, opening hours, and CCTV if necessary.
4. Write a public response.
5. Report the review to Google if it appears to violate its policies.
6. Follow up, or give up if the review remains online.

**Future workflow**
1. New reviews are collected automatically or loaded from a sample CSV.
2. DineTrust analyses each review and assigns a low, medium, or high suspicion score.
3. It extracts factual claims and checks them against sample POS data and opening hours.
4. The owner sees the review, score, reasons, and evidence on one screen.
5. DineTrust drafts a calm public reply.
6. The owner approves or edits the reply. No reply is automatically posted in the MVP.

## Architecture

**Input:** Google review text, star rating, review date, sample restaurant order/POS data, and restaurant opening hours. For the demo, reviews are provided through a seeded file rather than a live Google connection.

**AI:** analyses the review, identifies suspicious signals, extracts factual claims, explains its risk assessment, and drafts a calm, policy-safe reply. It returns structured JSON for the application to process.

**Logic:**
1. Apply a rule to flag a burst of three or more one-star reviews within 24 hours.
2. Compare extracted claims against sample order records and opening hours.
3. Label evidence as match, mismatch, or no data.
4. Treat the score as a suspicion signal, not proof that a review is fake.
5. Keep all public actions subject to owner approval.

**Action:** the workflow sends review text to the AI, applies the rules, checks available restaurant data, and passes the results to the web app.

**Output:** one decision screen showing the original review, suspicion score, reasons, evidence checks, and a suggested reply with Approve and Edit options.

**What stays human:** the restaurant owner makes the final decision about whether a review is suspicious, whether to report it, and whether to publish the reply. DineTrust does not automatically accuse reviewers or take public action.

**Why these tools:**
1. **AI model:** understands review text, extracts claims, explains suspicious signals, and drafts replies.
2. **n8n:** connects the steps and automates workflow logic.
3. **GitHub:** stores code, versions prompts, and tracks test cases.
4. **Vercel:** hosts the decision screen and application.
5. **Sample CSV:** enables a working demo without waiting for Google API access.

**Failure cases:**
1. **A genuine complaint is flagged:** the owner checks the evidence. A suspicion score alone is not grounds to report it.
2. **A fake review is missed:** the owner can still review suspicious cases manually; more reviewer-history signals can be added later.
3. **The reply contains invented facts or private information:** the owner must review and edit the draft before using it. Unsupported claims and sensitive details must be removed.

### As built in this MVP

The text above is the target design. This repository implements a simplified version of it:

| Target design | What is built here |
|---|---|
| Claude analyses reviews | Gemini (`gemini-3.6-flash` by default; set `GEMINI_MODEL` to change). One small file, `lib/ai.ts`, makes the call. |
| n8n runs the workflow | No n8n. The claim checks, burst rule and final-risk rule are plain TypeScript functions in `lib/checks.ts`. n8n can return for scheduled pulls from Google. |
| Hosted on Vercel | Runs locally with `npm run dev`; not deployed. |
| Reviews from a seeded CSV | 8 seeded reviews in `data/reviews.json`, plus a paste box. No CSV import. |
| Approve and Edit | The reply box is editable; Approve shows "Approved – ready to paste into Google" and a Copy button. Nothing is posted. |
| Policy-safe reply | Plain code flags drafts that are too long or mention records, refunds or accusations. |
| Failure handling | Empty, too-short or non-review text, a missing or rejected key, a busy or slow AI, and unreadable AI output each show a plain message. No crash. |

**Flow in the code:** Input (`app/page.tsx`, `lib/validate.ts`) → AI call 1 (`app/api/check`) → Logic (`lib/checks.ts`) → AI call 2 (`app/api/reply`) → Action (owner edits and approves) → Output (`components/`). Prompts live in `lib/prompts.ts`.

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
