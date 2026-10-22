# DineTrust

A daily tool for restaurant owners to tell fair bad Google reviews from suspicious ones. DineTrust checks each review's claims against your own opening hours, tables, bills and reservations, shows a score with the reasons, and helps you reply calmly, report fakes and brief your manager.

## What is in the app

| Page | What it does |
|---|---|
| **Dashboard** (home) | Average rating, reviews this week, % suspicious and reviews waiting for a reply. A rating trend line, a suspicious-vs-genuine chart and a "Needs attention" list of new 1–2 star reviews with a one-click Check. |
| **Inbox** | Every review with a status (New → Checked → Replied → Reported), filters (status, stars, verdict, date), search, and a bulk **Check selected** queue with a progress bar. Add reviews by pasting them in. |
| **Review detail** | Verdict stamp, confidence, a weighted score breakdown ("why this score"), the claim-vs-record list, reply drafts in English, Hindi or Hinglish with Warm, Professional or Short tone, a WhatsApp note for the manager, and for suspicious reviews a copy-ready Google report plus a downloadable PDF. |
| **Insights** | Footfall calendar (how busy each day was, next to the days bad reviews claim visits), complaints grouped by theme, and look-alike reviews. |
| **Records** | Upload bills and reservations as CSV with a column-mapping step, or use the demo data. Sample CSVs to download. |
| **My Restaurant** | Name, contact details, opening hours per day with lunch and dinner times, number of tables and the largest party you can seat. Every check uses these. A first-time setup walks you through it, with a "demo restaurant" shortcut. |
| **About** (`/about`) | A short page on the problem, how it works and privacy, with a "Try the demo" button. |

Everything you do is saved in your browser, so a refresh keeps your statuses, checks, drafts, records and settings.

### Free-tier friendly

The app is built for Gemini's free plan, which allows only a few AI calls a minute:
- AI calls are queued one at a time, at least 12 seconds apart, with a visible countdown.
- If the AI says it is busy, the queue waits a minute and tries again (twice at most).
- Every check and every reply draft is saved, so the same review is never checked twice. A result is marked out of date, not re-run, when you change your restaurant details.
- If a model's free quota runs out, the app tries the next one.

## Job to be done

> When I receive a suspicious negative Google review, I want to understand whether it may be fake and how to respond, so I can protect my restaurant's reputation without spending hours investigating it.

## The 3 tests

1. **Speed.** Pick a review (or add one with its date and stars) and click **Check review**. Within about 10 seconds a verdict and the reasons appear.
2. **Evidence and reply.** Each factual claim is marked **match**, **mismatch** or **no record** against your records, and a calm reply draft can be edited and approved. A claim with nothing to check against always shows "no record", never "mismatch".
3. **Bad input.** Empty text, text too short to be a review, text that isn't a review, or the AI failing or timing out shows a clear message instead of a score, and the app doesn't crash.

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

### How this repository differs from the target design

| Target design | What is built here |
|---|---|
| Claude analyses reviews | Gemini (`gemini-3.6-flash` by default, with fallbacks when its free quota runs out). One small file, `lib/ai.ts`, makes the call, so switching provider means changing only that file. |
| n8n runs the workflow | No n8n. The claim checks, burst rule, similarity check and scoring are plain TypeScript in `lib/`. n8n can return for scheduled pulls from Google. |
| Reviews from a CSV or Google | 23 seeded demo reviews plus a form to add your own. No CSV import of reviews and no Google connection. |
| Approve and Edit | Replies are editable, copyable and can be marked as replied. Nothing is posted to Google or WhatsApp for you. |
| Policy-safe reply | Plain code flags drafts that are too long or mention records, refunds, amounts, bill numbers, accusations or the reviewer's name. |
| Failure handling | Empty, too-short or non-review text, a missing or rejected key, a busy or slow AI and unreadable AI output each show a plain message. No crash. |

**Where the code lives:** the screens are in `components/` and `app/`; the API routes (`app/api/check`, `reply`, `insights`) call the AI; `lib/checks.ts` does the claim lookups and scoring; `lib/insights.ts` builds the dashboard data, footfall and look-alike pairs; `lib/settings.ts` holds the restaurant settings; `lib/pdf.ts` writes the PDF report; `components/AppProvider.tsx` holds the saved state and the AI queue.

## Known limits

- **Free-tier Gemini keys are rate-limited** and sometimes slow or overloaded. The app queues and retries, but a big batch takes minutes (about 12 seconds per review at best). A paid key removes this.
- A "mismatch" means no matching bill or reservation was found in the records you gave it. A large group split across several bills could look like a false mismatch.
- Theme counts, the "genuine complaints" screen and the footfall calendar use keywords and simple date reading, not the AI, so treat them as a guide.
- The PDF report uses plain Latin letters: Hindi or other scripts in a review show as "?".
- Closing after midnight is not supported yet: enter 23:59 for a late close.
- All demo data is made up. The sample bills cover 13–18 October 2026.

## Run it locally

You need Node.js 20 or newer (LTS) and a Gemini API key from https://aistudio.google.com/apikey.

```bash
git clone <this repo's URL>
cd review-checker
npm install
cp .env.example .env.local
```

Open `.env.local` and paste your key after `GEMINI_API_KEY=` (no spaces or quotes). Optional settings: `GEMINI_MODEL` (default `gemini-3.6-flash`) and `GEMINI_FALLBACK_MODELS` (comma-separated, default `gemini-3.8-flash,gemini-3.5-flash-lite`, tried in order when a model's free quota is used up). Then:

```bash
npm run dev
```

Open http://localhost:3000 and either finish the short setup or choose "Skip and use the demo restaurant". Restart `npm run dev` after changing `.env.local`.

**On Vercel:** set `GEMINI_API_KEY` (and optionally the two model variables) under Project → Settings → Environment Variables, then redeploy.

`.env.local` is ignored by git. Never commit your key.

## Project layout

```
app/page.tsx              the app shell: header, tabs, onboarding gate
app/about/page.tsx        the About page
app/api/check/route.ts    AI call 1: read the review, then run the checks and scoring
app/api/reply/route.ts    AI call 2: draft a reply (language, tone, approach)
app/api/insights/route.ts dashboard data, footfall, themes, look-alike reviews (no AI)
components/               Dashboard, Inbox, ReviewDetail, ReplyComposer, SettingsPanel, ...
lib/                      ai, prompts, checks, similarity, insights, settings, records, pdf, store, ...
data/                     reviews.json, orders.csv, reservations.csv (demo data)
public/                   sample-bills.csv, sample-reservations.csv
```
