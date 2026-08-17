# Kira

A mobile-first, installable PWA that teaches bookkeeping through short
retrieval-practice sessions. Bilingual (Bahasa Malaysia / English), works
fully offline, aligned to the SPM Prinsip Perakaunan progression.

**Live: https://kira.accme.my/**

---

## Learning design

Every feature is tied to a research-backed principle (see
[the build spec](Bookkeeping_App_Build_Spec.md) §2):

| Principle | How Kira implements it |
|---|---|
| **Retrieval practice** | Every session is questions, never passive notes. |
| **Spaced repetition** | A Leitner scheduler resurfaces items at growing intervals (`0 · 1d · 3d · 7d · 21d`). Wrong answers drop to box 1 and reappear the same session. |
| **Worked examples** | A new skill opens with an "I do" card before the first question. |
| **Backward fading** | `faded_step` items show a procedure as a worked solution with steps blanked out. A lesson ladders from "only the last line is blank" to a cold solve. Fading lives in the content, not the code — a step's own value *is* the answer key, so a ladder cannot drift out of sync with its solution. |
| **Immediate feedback + self-explanation** | Instant right/wrong with a one-line *why*. On error-prone misses (debit/credit direction, provision-before-vs-after-writeoff) the explanation is withheld behind a "why?" prompt so the learner retrieves the rule first. |
| **Desirable difficulty** | ≤4 new items per session, one skill per micro-lesson, types interleaved within a session. |

## Content

**356 items across 22 topics**, Stages 1–7:

1–2. The accounting equation · forms of business & who sets the rules · debits &
   credits · source documents · books of first entry · petty cash & the
   imprest · journal entries, from naming the two accounts to building the
   whole entry · spotting what is wrong with an entry, then correcting it
3. Ledger & T-accounts · balancing off · the trial balance
4. Income statement · valuing closing inventory · statement of financial position
5. Year-end adjustments — accruals & prepayments · depreciation (straight line,
   reducing balance, revaluation) · disposal of an asset · bad debts &
   provisions
6. Bank reconciliation · control accounts · correction of errors & suspense ·
   incomplete records · club & society accounts · partnership accounts,
   including section 26 and dissolution
7. Limited company accounts including share issues · manufacturing accounts &
   break-even · ratio analysis · cash budgets

Eight interaction types: `classify`, `debit_credit`, `numeric`,
`journal_entry`, `t_account`, `spot_error`, `statement_build`, `faded_step`.

Fifteen of the lessons are **fading ladders** — the same procedure authored
three times, one more step blanked each rung. They sit on the procedures where
the order of the steps is the whole lesson: the journal entry, straight-line
depreciation, write-off-then-provide (providing on the pre-write-off figure is
the classic miss), balancing off a ledger account (the balance c/d goes on the
*smaller* side), the bank reconciliation, the control account, clearing a
suspense account to nil, profit by capital comparison, the subscriptions
working, the partnership appropriation, the company appropriation, the
manufacturing account, both profit margins, a month of a cash budget, and
disposing of a non-current asset.

A numeric answer is a whole, non-negative figure — the input accepts digits
only — and its unit is authored, not assumed: a currency leads its figure
(`RM 1,500`) and a ratio unit trails it (`20%`, `8 times`, and `8 kali` when
the learner is reading in BM).

### Authoring

Content is **data, not code**. [`seed_content.json`](seed_content.json) at the
repo root is the single source of truth — `src/content/loader.ts` imports it
directly, so adding a stage is a file edit. Item schema lives in
[`src/content/types.ts`](src/content/types.ts).

After **any** content edit, run the content guard:

```bash
npm test -- src/content
```

It checks bilingual coverage, per-type integrity (Dr = Cr, T-account balances
match their entries, statement figures reconcile, a fading ladder never
un-fades) and round-trips the grader against every item's own answer — so a
wrong answer key fails the build.

## Getting started

```bash
npm install
npm run dev        # dev server
npm test           # 301 hermetic unit + component tests (the CI gate)
npm run typecheck
npm run build      # production build + service worker
npm run preview    # serve the built app (use this to test offline/install)
```

Two further suites exist and are deliberately **not** part of `npm test`:

```bash
KIRA_ALLOW_PROD_TESTS=1 npm run test:integration   # 12 tests vs live Supabase
./supabase/tests/run.sh    # RLS policies vs a throwaway local Postgres
```

`test:integration` is excluded from CI so a deploy never depends on Supabase
uptime, and so pushes don't mint throwaway anonymous users. `run.sh` applies
every migration to a scratch database and asserts the security policies
(22 RLS + 13 leaderboard + 15 push + 23 roster + 14 avatar + 13 last-wrong +
19 item-notes + 22 class-insight + 19 probe-cleanup checks) — **run it before applying
any new migration to production.**

## Architecture

Local-first. All reads and writes hit IndexedDB (Dexie); content is bundled at
build time, so the app needs no network after first load.

```
src/
  content/    content model, loader, bilingual helpers   (+ content.test.ts)
  scheduler/  Leitner boxes — pure, FSRS-swappable        (+ tests)
  grading/    one pure grader per interaction type        (+ tests)
  session/    queue assembly: due items + new, interleaved (+ tests)
  db/         Dexie schema and the single data-access seam
  sync/       Supabase client, sync, identity, classes, push
  app/        progress + derived badges
  components/ screens + one renderer per interaction type
```

`scheduler.ts`, `grade.ts` and `buildQueue.ts` are pure modules with no I/O —
the scheduling and marking rules are unit-tested independently of the UI.

Two design languages, deliberately. Learner screens (home, session end, badges,
profile) use `components/play.tsx` — rings, count-ups, celebration bursts.
Teacher and parent screens stay on the sober `components/ui.tsx`: a progress
report should look like a report, not like a game.

## Mock exam

A paper shaped like SPM Kertas 1: **40 multiple-choice questions in 75 minutes**,
drawn across the syllabus to a blueprint modelled on the real 2024 paper rather
than on whatever the bank happens to hold most of.

**All 22 topics are examinable.** Journals and error-spotting used to be
missing, because those two topics held nothing a multiple-choice paper could
ask — and nothing failed when they were skipped, since the paper was still a
full 40 questions. A test now fails the build if any topic the bank could
examine is left out of the blueprint, because a paper that quietly omits a
topic hands back a flattering score.

Nothing is marked until the paper is handed in, and every answer stays
revisable until then — tapping the chosen option again rubs it out. The clock
does not stop, and hands the paper in itself when it runs out. The result opens
on the score and then on a topic breakdown, weakest first, because the useful
output of a mock is "revise these two", not a number.

Answers count as ordinary practice: they move the spaced-repetition schedule
and reach the teacher's report like any other attempt. Questions left blank do
not — an unanswered question is a fact about the clock, not about whether the
learner knows the item.

## Cloud features

The app stays local-first — every read and write hits IndexedDB, and the whole
thing works with no network. Everything below is additive, and the app runs
unchanged when Supabase credentials are absent.

- **Sync.** `review_state` and `attempts` reconcile last-write-wins on
  `updatedAt`. No outbox table is needed: rows carry their own timestamps, so
  "everything newer than the last sync" is a complete, replay-safe description
  of what to push.
- **Identity.** Zero-friction anonymous auth, upgradable to a durable account
  by adding an email (OTP). Linking keeps the same user id, so no progress is
  lost. **Signing in ADOPTS** the account instead — local rows are replaced by
  that account's, because a shared classroom tablet must not fold one learner's
  practice into the next learner's account.
- **Classroom.** A teacher creates a class and shares a join code; learners
  join themselves. A teacher may READ — never write — the progress of learners
  in their own classes. Classmates can see each other's leaderboard rank but
  *not* each other's answers.
- **Acting on a miss.** In the teacher's view, a recently-missed question opens
  up: the question as the learner met it, the answer, the explanation they were
  shown, what they actually answered last time with the wrong parts marked,
  and how many other items drill the same skills. If the explanation is
  the problem, the teacher writes a better one and copies an authoring brief —
  content is data, so the way to act on a miss is to hand the author a brief,
  not to open a CMS that does not exist. Almost all of it is local: the server
  only ever sends an item id, and the bank is already in the bundle.

  That better explanation is **kept**, against the item rather than against the
  learner who happened to miss it — so it is written once and is there the next
  time anyone gets that question wrong. It is visible only to whoever wrote it:
  a note is an adult writing frankly about a child's mistake, not feedback
  addressed to the child, and text authored by one user and rendered to another
  is a surface a classroom app should not open. The UI never reports a save it
  has not had confirmed, and says to copy the text out when a save fails.
- **Knowing what to do about it.** Each learner on the roster carries one line
  saying what to do tonight — reviews due, gone quiet for nine days, finding it
  hard, or up to date — and the roster sorts by that rather than by who
  practised last. Going quiet outranks everything, because spaced repetition
  that is not returned to is just forgetting on a schedule. A learner who
  joined and never practised is reported as a *cause* rather than a 0%: in this
  app that is almost always the same thing, an account signed in on a different
  device. The teacher's saved explanations gather on one screen, and every
  recent miss can be handed over as a single authoring request.
- **Gamification.** Session combos (accuracy-based, never timed — a clock would
  fight the self-explanation gate), 20 badges derived from synced data rather
  than stored, and a class leaderboard ranked by items practised in the last 7
  days. That metric is self-capping, so it rewards steady review instead of
  grinding; ranking by XP would pull learners away from their due reviews.
- **Daily reminders.** Web push, sent by a Supabase Edge Function on an hourly
  cron that picks whoever's *local* hour matches their chosen time and actually
  has reviews due.
- **Names and faces.** A display name and an emoji avatar, set by any learner
  from the home header — local-first in Dexie, pushed to the cloud so they reach the
  leaderboard and the teacher's roster. An avatar is derived from the user id
  until one is chosen, so a leaderboard is never a wall of blanks. The allowed
  faces are a CHECK constraint in the database, not client-side validation:
  `profiles` is self-service under RLS, so whatever a learner can store is
  drawn on their classmates' screens.

Security note: **RLS is the only boundary** — the publishable key ships in a
public bundle by design. Policies are tested in `supabase/tests/`.

## Deployment

Pushing to `main` runs the tests and build, then deploys to GitHub Pages
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). The Pages
source must be set to **GitHub Actions** (not "deploy from a branch"). The Vite
`base` is relative, so the app works at a domain root or under a subpath;
`public/CNAME` pins the custom domain across deploys.

Schema changes are **applied by hand** in the Supabase SQL Editor
(`supabase/migrations/`), and the reminder sender is deployed with
`supabase functions deploy send-reminders --project-ref …`.

## Not built yet

- **Native apps.** A Capacitor wrap for the App Store / Play Store. Deferred
  while the app still ships several times a day — store review turns a
  2-minute deploy into a 1–3 day cycle.
- **Kertas 2.** SPM Prinsip Perakaunan is two papers. 3756/1 — 40 multiple
  choice in 1h15 — now has a mock (see above). 3756/2 is 2h30 of prepared
  statements and written justification: partial credit across a 13-mark
  statement, the own-figure rule, and "which business would you invest in, and
  why". None of that is gradeable by a pure function, and a version that only
  checked the final figure would teach the wrong lesson about how it is marked.
- **More past papers.** The terminology and coverage checks are only as good as
  the papers they are checked against, and today that is one year (SPM 2024).
  A wider corpus is catalogued in an external pipeline repo; using it is
  measurement, not content — questions are not copied in.
- FSRS scheduling, and the multi-tenant authoring UI.
