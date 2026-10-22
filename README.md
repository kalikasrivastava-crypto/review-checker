# DineTrust

A daily tool for restaurant owners to tell fair bad Google reviews from suspicious ones. DineTrust checks each review's claims against your own opening hours, tables, bills and reservations, shows a score with the reasons, and helps you reply calmly, report reviews that conflict with your records and brief your manager.

## What is in the app

| Page | What it does |
|---|---|
| **Dashboard** (home) | Average rating, reviews this week, % suspicious and reviews waiting for a reply. A rating trend line, a suspicious-vs-genuine chart and a "Needs attention" list of new 1–2 star reviews with a one-click Check. |
| **Inbox** | Every review with a status (New → Checked → Replied → Reported), filters (status, stars, verdict, date), search, and a bulk **Check selected** queue with a progress bar. Add reviews by pasting them in. |
| **Case Report** (one screen per checked review) | The review as a quote with every claim underlined (green matches, red conflicts, dotted grey can't verify). A HIGH / MEDIUM / LOW RISK stamp with a small score beside it and a 2-3 sentence plain-English explanation that gives only confirmed conflicts as reasons. "Claim by claim" in three groups: **Confirmed mismatch** (your records contradict it), **Confirmed match** (your records support it) and **Can't verify / missing data** (opinions like rude staff or cold food, or no data for that day), each claim with its evidence and a source label (POS bills, Reservations, Opening hours, Restaurant settings, Footfall). A "How this score was calculated" toggle lists every point and jumps to the claim it came from. Then one recommended next step by risk level, a ready-made reply in English, Hindi or Hinglish (no AI needed), PDF, WhatsApp and mark as replied. Reviews you added yourself can be deleted, with a confirm step. |
| **Insights** | Footfall calendar (how busy each day was, next to the days bad reviews claim visits), complaints grouped by theme, and look-alike reviews. |
| **Records** | Upload bills and reservations as CSV with a column-mapping step, or use the demo data. Sample CSVs to download. |
| **My Restaurant** | Name, contact details, opening hours (same every day, or per day, with a Closed toggle and lunch and dinner times), number of tables, seats per table, how long a party keeps a table, and the largest party you can seat. Every check uses these, including whether enough tables were free at the time a review says it visited. "Reset to sample data" puts the sample restaurant back. |
| **About** (`/about`) | A short page on the problem, how it works and privacy, with a "Try the demo" button. |

### First-time experience

A new visitor sees a welcome screen: a one-line headline, the three steps (add your records, pick a review, get a case report) and two buttons.

- **Try the demo** opens a private copy of a made-up restaurant and opens Dan K.'s review with its case report already filled in from a saved result (no AI call). A four-step tour points at the risk level, the conflicting claims, the missing data and the next step, and can be skipped. A banner on every page says you are viewing sample data and links to setup.
- **Setting up your own restaurant** (after sign-up) is three short steps with a progress bar: details, hours and tables (sensible defaults pre-filled), then optional bills and reservations. Each upload box has a CSV template (`public/dinetrust-bills-template.csv`, `public/dinetrust-reservations-template.csv`), a column table, a preview of the first five rows and plain row errors such as "Row 7: time 'late' should look like 20:00". "Skip for now" is always there. After setup, "Check your first review" has a paste box and an **Use an example review** button that shows a result straight away.
- The **?** button in the header reopens the tour, the templates, "What data do I need?" and a five-question FAQ.

The sample reviews and the example review ship with their claims already pulled out (`lib/demo.ts` and the demo template in the database), so `/api/check` skips the AI and runs only the code checks.

### Two interfaces, one database

| Address | Who it is for | What it does |
|---|---|---|
| `/` | Everyone | A short landing page with two buttons: **I'm a restaurant owner** and **Try the demo**. |
| `/restaurant` | Owners | Email and password login or sign-up (Supabase Auth), then the setup steps and everything above. A header shows "Owner area", the restaurant name and Log out. **Try demo** gives each visitor a private copy of the Demo Restaurant, with no sign-up. |
| `/r/<restaurant>` | Guests | A friendly mobile page reached from a QR code: star rating, visit date and time, party size, optional bill number, comment, optional name and phone. A bill number that matches a real bill shows "Verified visit" (checked in the database; no bill detail is shown). 1 to 3 stars go privately to the owner's **Guest feedback** tab; 4 and 5 stars get a "Share on Google" button. |

Owners find their guest page link, a printable QR poster, a preview button and a Google review link field under **My Restaurant → Your customer page**.

**Data and privacy.** Everything lives in Supabase: restaurants, bills, reservations, reviews, case reports, replies and guest feedback. Row Level Security means each owner reads and writes only their own restaurant's rows; guests have no access to any table and can only call two small database functions (read a restaurant's name and Google link, and send feedback). The secret key is used only on the server, only to create demo accounts. A review's claims are saved with it, so the AI reads each review's text at most once. The AI never receives records or guest details. New feedback, reviews and checks appear on the dashboard and inbox instantly (Supabase Realtime).

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
| Claude analyses reviews | Gemini only extracts the claims; it never sees your records and never judges the review. Every comparison and every point of the score is plain code. Model: Gemini (`gemini-3.6-flash` by default, with fallbacks when its free quota runs out). One small file, `lib/ai.ts`, makes the call, so switching provider means changing only that file. |
| n8n runs the workflow | No n8n. The claim checks, burst rule, similarity check and scoring are plain TypeScript in `lib/`. n8n can return for scheduled pulls from Google. |
| Reviews from a CSV or Google | 23 seeded demo reviews plus a form to add your own. No CSV import of reviews and no Google connection. |
| Approve and Edit | Replies are editable, copyable and can be marked as replied. Nothing is posted to Google or WhatsApp for you. |
| Policy-safe reply | Plain code flags drafts that are too long or mention records, refunds, amounts, bill numbers, accusations or the reviewer's name. |
| Failure handling | Empty, too-short or non-review text, a missing or rejected key, a busy or slow AI and unreadable AI output each show a plain message. No crash. |

**Where the code lives:** (the owner screens now read and write Supabase through `components/AppProvider.tsx`) the screens are in `components/` and `app/`; the API routes (`app/api/check`, `reply`, `insights`) call the AI; `lib/checks.ts` does the claim lookups and scoring; `lib/insights.ts` builds the dashboard data, footfall and look-alike pairs; `lib/settings.ts` holds the restaurant settings; `lib/pdf.ts` writes the PDF report; `components/AppProvider.tsx` holds the saved state and the AI queue.

## Known limits

- **Free-tier Gemini keys are rate-limited** and sometimes slow or overloaded. The app queues and retries, but a big batch takes minutes (about 12 seconds per review at best). A paid key removes this.
- A "mismatch" means no matching bill or reservation was found in the records you gave it. A large group split across several bills could look like a false mismatch.
- Theme counts, the "genuine complaints" screen and the footfall calendar use keywords and simple date reading, not the AI, so treat them as a guide.
- In the PDF report, Hindi and other non-Latin lines are drawn as images (so the joined letters print correctly) and can't be selected or searched as text. Latin text stays real text.
- Closing after midnight is not supported yet: enter 23:59 for a late close.
- All demo data is made up. The sample bills cover 13–18 October 2026.

## Run it locally

You need Node.js 20 or newer (LTS), a Gemini API key from https://aistudio.google.com/apikey and a free Supabase project.

```bash
git clone <this repo's URL>
cd review-checker
npm install
cp .env.example .env.local
```

Open `.env.local` and fill in (no spaces or quotes): `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` (the secret key has no `NEXT_PUBLIC_` prefix, so it never reaches the browser). Optional: `GEMINI_MODEL` (default `gemini-3.6-flash`) and `GEMINI_FALLBACK_MODELS`. Then:

```bash
npm run dev
```

Open http://localhost:3000. Restart `npm run dev` after changing `.env.local`. The database tables, security rules and demo data are created by the SQL in `supabase/schema.sql`, then `supabase/seed.sql` (run each once in Supabase → SQL Editor).

**On Vercel:** add the same four variables under Project → Settings → Environment Variables, then redeploy.

`.env.local` is ignored by git. Never commit a key.

## Project layout

```
app/page.tsx              the landing page
app/restaurant/page.tsx   the owner's area: login, setup, header, tabs
app/r/[slug]/page.tsx     the guest feedback page opened from a QR code
app/about/page.tsx        the About page
app/api/check/route.ts    AI call 1: pull the claims out of the review. Code then checks them and scores the case
app/api/reply/route.ts    AI call 2: draft a reply (language, tone, approach)
app/api/insights/route.ts dashboard data, footfall, themes, look-alike reviews (no AI)
app/api/demo/route.ts     makes a throwaway account for "Try demo" (needs the secret key)
components/               Dashboard, Inbox, ReviewDetail, ReplyComposer, SettingsPanel, ...
lib/                      ai, prompts, checks, similarity, insights, settings, records, pdf, store, ...
data/                     reviews.json, orders.csv, reservations.csv (the demo data the database was seeded from)
supabase/schema.sql       tables, security rules, functions (for a fresh Supabase project)
public/                   sample CSVs and the two CSV templates
```
