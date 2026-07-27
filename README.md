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

**186 items across 17 topics**, Stages 1–6:

1–2. The accounting equation · debits & credits · journal entries · spot the error
3. Ledger & T-accounts · the trial balance
4. Income statement · statement of financial position
5. Year-end adjustments — accruals & prepayments · depreciation · bad debts & provisions
6. Bank reconciliation · control accounts · correction of errors & suspense ·
   incomplete records · club & society accounts · partnership accounts

Eight interaction types: `classify`, `debit_credit`, `numeric`,
`journal_entry`, `t_account`, `spot_error`, `statement_build`, `faded_step`.

Nine of the lessons are **fading ladders** — the same procedure authored three
times, one more step blanked each rung. They sit on the procedures where the
order of the steps is the whole lesson: the journal entry, straight-line
depreciation, write-off-then-provide (providing on the pre-write-off figure is
the classic miss), the bank reconciliation, the control account, clearing a
suspense account to nil, profit by capital comparison, the subscriptions
working, and the partnership appropriation.

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
npm test           # 110 hermetic unit + component tests (the CI gate)
npm run typecheck
npm run build      # production build + service worker
npm run preview    # serve the built app (use this to test offline/install)
```

Two further suites exist and are deliberately **not** part of `npm test`:

```bash
npm run test:integration   # 8 tests against the live Supabase project
./supabase/tests/run.sh    # RLS policies vs a throwaway local Postgres
```

`test:integration` is excluded from CI so a deploy never depends on Supabase
uptime, and so pushes don't mint throwaway anonymous users. `run.sh` applies
every migration to a scratch database and asserts the security policies
(22 RLS + 11 leaderboard + 15 push reminder checks) — **run it before applying
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
- **Gamification.** Session combos (accuracy-based, never timed — a clock would
  fight the self-explanation gate), 20 badges derived from synced data rather
  than stored, and a class leaderboard ranked by items practised in the last 7
  days. That metric is self-capping, so it rewards steady review instead of
  grinding; ranking by XP would pull learners away from their due reviews.
- **Daily reminders.** Web push, sent by a Supabase Edge Function on an hourly
  cron that picks whoever's *local* hour matches their chosen time and actually
  has reviews due.

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
- Stage 7+ content, FSRS scheduling, and the multi-tenant authoring UI.
