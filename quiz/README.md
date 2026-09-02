# Live Quiz

A live, multiple-choice quiz app: an audience scans a QR code on their
phones to join the quiz currently running, answers questions for
speed-based points, and follows a live leaderboard. A separate "big
screen" page can be added to OBS as a Browser Source so a stream
audience sees the same thing. Static HTML/CSS/JS, no build step — the
only backend is a dedicated Supabase project, used purely as a
database + host login, same pattern as the Party Padel site this repo
also hosts, but a **separate Supabase project** so quiz data never
mixes with padel data.

## What's here

| Page | Who uses it | Purpose |
|---|---|---|
| `host.html` | You (logged in) | Create quizzes and questions, then run a live session: QR code, join code, start/reveal/next-question/leaderboard controls, live player list. |
| `display.html?session=<id>` | OBS / a projector | The public "big screen" — lobby QR, live question + countdown, answer reveal, leaderboard, final podium. No login, no controls. |
| `play.html?code=<code>` | Players, on their phones | Join with a nickname, answer questions, see their own result and rank. What the QR code opens. |

## One-time setup

1. **Create a new Supabase project** at [supabase.com](https://supabase.com)
   — a *different* project from the one Party Padel uses, so this
   app's data stays isolated. Note its **Project URL** and **anon
   public key** from Project Settings > API.
2. **Run the schema**: Supabase Dashboard > SQL Editor > New query,
   paste in the entire contents of `quiz/supabase/schema.sql`, run
   it. This creates the `quizzes`/`quiz_questions`/`quiz_sessions`/
   `quiz_players`/`quiz_answers` tables, the row-level security
   policies that keep correct answers hidden from players until
   reveal, and the `submit_quiz_answer` scoring function.
3. **Create your host login**: Authentication > Users > Add user —
   email + password, whatever you want to sign in with at
   `quiz/host.html`. There's no sign-up form anywhere in the app;
   this is the only way an account gets created.
4. **Turn off public sign-up**: Authentication > Providers > Email,
   disable "Allow new users to sign up." The anon key from step 1 is
   meant to be public (it ships in this app's source to every
   visitor's browser) — the write policies in `schema.sql` only check
   "is someone logged in," not "is it specifically you," so turning
   off sign-up is what keeps that narrow to the account you made in
   step 3.
5. **Fill in `quiz/assets/js/supabase-config.js`** with the Project
   URL and anon key from step 1, then deploy the site as usual.
6. Visit `https://YOURDOMAIN/quiz/host.html` and sign in.

Run locally the same way as the rest of this repo — any static file
server, e.g. `python3 -m http.server 8000` from the repo root, then
visit `http://localhost:8000/quiz/host.html`.

## Running a live quiz

1. In `host.html`, create a quiz and add questions (2-4 options each,
   mark the correct one, set a time limit and point value per
   question — defaults are 20 seconds / 1000 points).
2. Click **Host this quiz**. This starts a session and shows a QR
   code + a 6-character join code — put this up wherever your
   audience can scan or read it.
3. Add the **display URL** shown under "Players" (`display.html?session=…`)
   to OBS as a **Browser Source** — see "OBS setup" below.
4. Players scan the QR (or visit `/j/` and type the code) on their
   phones, enter a name, and land in a waiting screen.
5. **Start quiz** begins question 1 on every screen at once. Once
   time's up (or whenever you like — the countdown doesn't auto-lock,
   you're in control of pacing), click **Reveal answer** to show the
   correct answer and how everyone answered. From there, **Show
   leaderboard** and/or **Next question** — the button relabels itself
   to **Finish quiz** on the last question.
6. If you accidentally close or refresh `host.html` mid-session, sign
   back in and a **Resume hosting** banner appears on the dashboard —
   the session itself keeps running in the database the whole time,
   independent of whether the host tab is open.

### OBS setup

In OBS: **Sources > + > Browser Source**, paste the display URL
(`https://YOURDOMAIN/quiz/display.html?session=<id>`, copied from
`host.html` once a session has started), set the size to your canvas
resolution (e.g. 1920×1080), and leave "Shutdown source when not
visible" **off** so it keeps its live connection while you're on
another scene. It's a full opaque screen (not a transparent overlay),
designed to be the whole scene while the quiz is live.

Each new session gets a new `session` id, so update the Browser
Source's URL (or just its query string) whenever you start a fresh
session — the QR/join-code lobby screen for the new session will only
show up once you do.

### Scoring

Answering correctly awards between 50% and 100% of a question's point
value depending on how fast you answered within its time limit — an
instant correct answer scores full points, one submitted right at the
buzzer scores half; a wrong answer scores zero. This is computed
server-side (`submit_quiz_answer` in `schema.sql`), from a timestamp
the database itself records, not one a phone could fake, and reads
the real answer key from a table the player's browser can never query
directly — so this can't be cheated by inspecting network requests or
page source before answering, only the trusted host client ever
handles the real answer key before reveal time.

## Editing content

- **Colours/type/spacing**: `quiz/assets/css/tokens.css` — this app
  has its own token set, deliberately distinct from the Party Padel
  brand at the repo root; nothing else should have a hardcoded value.
- **Shared components** (buttons, cards, answer tiles, countdown
  ring, leaderboard rows): `quiz/assets/css/style.css`.

## Deploying

Same as the rest of this repo: a plain static site, deploy the whole
`quiz/` and `j/` directories anywhere (GitHub Pages, Netlify, Vercel,
Cloudflare Pages, or any web host) alongside the existing Party Padel
pages. `quiz/supabase/` is reference SQL only, not needed at runtime.
