# Kira — CLAUDE.md

## What this is
A mobile-first, installable, offline-first PWA that teaches SPM-level
bookkeeping through short retrieval-practice sessions. Bilingual (Bahasa
Malaysia default / English). Built for Julius's daughter first, architected to
become a JC Labs product (content-as-data, tenant-neutral schema).

**It is LIVE at https://kira.accme.my/ and has a real backend.** Real learner
progress, real classroom rosters, and a scheduled push sender all run against a
production Supabase project. Treat schema and Edge Function changes as prod.

## Run & verify
- Run locally: `npm run dev` (Vite; port varies)
- **Hermetic tests (the CI gate): `npm test`** — 190 passing, no network
- Live-backend tests: `npm run test:integration` — 10 passing, hits real Supabase
  (deliberately excluded from CI so deploys don't depend on Supabase uptime)
- RLS / SQL policy tests: `./supabase/tests/run.sh` — spins up throwaway local
  Postgres, applies all 7 migrations, runs 22 RLS + 13 leaderboard + 15 push
  + 23 roster + 14 avatar + 13 last-wrong + 16 probe-cleanup assertions.
  **Run this before handing Julius any new migration** — and note the
  probe-cleanup suite guards a destructive hand-run script, not a migration.
- Types: `npm run typecheck`
- Build: `npm run build`
- Deploy: push to `main` → GitHub Actions → GitHub Pages → kira.accme.my

## Map (only the load-bearing parts)
- `seed_content.json` (repo ROOT) — all 253 items / 21 topics / 43 lessons.
  Content is DATA; adding a stage — or a fading ladder — is a file edit.
  `src/content/loader.ts` imports it directly.
- `src/scheduler/scheduler.ts` — Leitner boxes 1–5, pure, FSRS-swappable
- `src/grading/grade.ts`, `src/session/buildQueue.ts` — pure, no I/O, unit-tested
- `src/db/data.ts` — the single data-access seam over Dexie/IndexedDB
- `src/sync/` — Supabase client, `sync.ts` (local-first reconcile), `identity.ts`
  (anon → email OTP), `classes.ts` (classroom), `push.ts` (web push)
- `faded_step` items carry NO separate `answer` — a step's own `value` is the
  key and `blank: true` marks it as asked. Authoring a fading ladder is just
  flipping `blank` on one more step per rung; the content guard enforces both
  that blanks form a SUFFIX (fading is backward — never blank the middle and
  hand over the answer) and that they never decrease within a lesson.
- **Submit rule:** an item commits on tap ONLY when the whole answer is that one
  tap — `classify`, `debit_credit`, and a `faded_step` with a single choice
  blank. Everything multi-part (T-account, statement build, double entry,
  multi-blank faded step) waits for Check, so an earlier answer stays revisable.
  Typing never auto-submits: there is no way to know a number is finished.
- `src/app/badges.ts` — badges are DERIVED from review_state + attempts, never
  stored, so they sync for free
- **Two design languages, on purpose.** Learner screens (Home, SessionComplete,
  Badges, ProfileSheet) use `components/play.tsx` — rings, count-ups, bursts,
  gradients. Teacher/parent screens (Classes, roster, Leaderboard) stay on the
  sober `components/ui.tsx`: a progress report should look like a report.
- `src/app/profile.ts` — the learner's own name + avatar, LOCAL-first in Dexie
  and pushed to Supabase as a best effort. The name used to live only in the
  cloud `profiles` table, which meant a learner practising alone could never
  set one.
- `supabase/migrations/000{1..7}_*.sql` — applied BY HAND via the SQL Editor
- `supabase/functions/send-reminders/` — Deno Edge Function, deployed via CLI

## Danger zone
- **Migrations are applied by hand by Julius in the Supabase SQL Editor.** There
  is no CLI/MCP path for schema (see ENV below). Always run
  `./supabase/tests/run.sh` first — a policy hole is far cheaper to catch there
  than after it is pasted into prod.
- **RLS is the ONLY security boundary.** The publishable key ships in a public
  bundle. Any new table needs a policy, and any `SECURITY DEFINER` function
  needs an explicit membership/ownership guard inside it.
- **Never commit** `.env`, `.vapid.local`, `.cron.local`, `.service.local`,
  `.cron_setup.ready.sql` (all gitignored). The VAPID *private* key and the
  service_role key must never reach a build.
- Edge Function secrets are set via `supabase secrets set --project-ref …`.

## Current state & direction
- **2026-07-27** — Shipped and verified live: Stage 5 content (93 items);
  cloud sync; email-OTP identity (sign-in ADOPTS an account, wiping local
  rather than merging); classroom model (join codes, teacher roster,
  leaderboard); gamification (combos, 20 derived badges); web push daily
  reminders (Edge Function + hourly pg_cron, real notification confirmed on
  Android); moved to the custom domain kira.accme.my.
- **2026-07-27 (later)** — `faded_step` backward fading shipped (Spec §3 type 6,
  the last unimplemented row of the §2 principles table). 9 new items in 3
  ladders: journal entry, straight-line depreciation, write-off-then-provide.
  Client-only — no schema, no Edge Function, no migration.
- **2026-07-27 (later still)** — Stage 6 content, authored fresh (not ported):
  6 topics / 84 items, taking the bank to 186. Bank reconciliation, control
  accounts, correction of errors & suspense, incomplete records, club &
  society accounts, partnership accounts. Each topic ends in a fading ladder
  (9 ladders now). **BM terminology was written by Claude, not ported from
  Julius's material — worth a read-through against the syllabus.**
- **2026-07-28** — Teacher/parent progress tracking made robust. Migration
  0005 APPLIED to prod and verified live. The roster now reads `class_roster`
  / `learner_item_stats` (SECURITY DEFINER, owner-guarded) instead of pulling
  every attempt row down and rolling up in JS, which PostgREST was silently
  truncating. Adds a per-learner detail view (per-topic bars, weakest skills,
  recent misses), bilingual skill names, localized relative times, and
  leave-class.
- **2026-07-28** — Learner-side restyle (`components/play.tsx`): Home as a
  dashboard with a mastery ring and next-badge nudge, a badges collection
  screen, a bigger session-end moment, and name + emoji avatar reachable by
  every learner. Migration 0006 APPLIED and verified live — a chosen face
  follows the account and shows on the leaderboard and the teacher's roster.
- **2026-07-28 (later)** — Balancing off, authored against a real stall: Ariel
  had cleared Stages 1–2 and got stuck closing T-accounts. Two new lessons in
  `t5-ledger`, 11 items, bank now 197. `l30-balance-off` drills the thing that
  actually trips people — the balance c/d is written on the SMALLER side while
  the account's real balance is on the larger one — and includes the two cases
  that break the guess "receivables are debit, payables are credit": a
  receivables account closing credit (customer overpaid) and a bank account
  closing credit (overdraft). `l31-faded-balancing` is the 10th fading ladder:
  total each side → put the difference on the smaller side as c/d → bring it
  down on the larger side as b/d, 2 → 4 → 6 blanks. New skill tag
  `balancing-off` (labelled in `loader.ts`, so it can name a weakness on the
  teacher's roster). Content-only — no schema, no migration, no Edge Function.
  **The BM here was written by Claude, so it wants the same read-through
  against the syllabus as Stage 6 — in particular c/d ("baki c/d") and b/d
  ("baki b/d"), which are kept as the English abbreviations on purpose.**
- **2026-07-28 (later still)** — Stage 7 content: 4 topics / 12 lessons / 56
  items, taking the bank to 253 and finishing the Form 5 syllabus. Limited
  company accounts (share capital, debentures, reserves, appropriation),
  manufacturing accounts (direct vs indirect vs non-factory, prime cost, cost
  of production), ratio analysis (margins, mark-up, liquidity, ROCE, turnover,
  collection period, and reading what a movement MEANS), and cash budgets
  (timing, and what never appears because no money moves). Each topic ends in
  a fading ladder — 14 ladders now. Content-only apart from one renderer
  change below. **BM authored by Claude again — same read-through needed.**
- **A numeric answer must be a whole, non-negative figure.** `AmountInput`
  strips every non-digit, so a decimal or a negative answer is unanswerable no
  matter how correct it is. The content guard now fails the build on one. This
  is why ratio items are figured to come out whole (a 20% margin IS a 25%
  mark-up) rather than to look realistic.
- **A numeric unit is authored, not assumed.** `unit` + `unit_ms` + `unitAfter`
  on a `numeric` item's data and on a `faded_step` number step. A currency
  leads its figure, a ratio unit trails it, and a WORD unit needs a BM label
  or a BM-first app shows English. All three are guarded in `content.test.ts`.
- **2026-07-29** — "Recently got wrong" opens up. A miss now expands to the
  question the learner actually met (`components/ItemPreview.tsx`, a READ-ONLY
  render of any of the 8 item types with the answer marked), the explanation
  they were shown, and how many other items already drill those skills. The
  teacher can type a better explanation and copy an authoring brief
  (`lib/authoringBrief.ts`) naming the item id, skills, difficulty and both
  language versions. **Zero backend work:** `recentMisses` already resolved
  each item from the LOCAL bundle — the server only ever sent an item id — so
  this needed no RPC, no migration and no RLS change.
  - The preview is deliberately NOT the interactive renderer: a gradeable
    widget on the teacher screen would record attempts against the TEACHER's
    own account while they review someone else's work. A test asserts it
    renders no inputs and no buttons.
  - The teacher's note is NOT persisted — it is copied out or lost, and the
    UI says so. Storing it means a table, a policy and a migration.
- **2026-07-29 (later)** — Migration 0007 `learner_last_wrong` APPLIED to prod
  and VERIFIED LIVE (`lastWrong.integration.test.ts`, plus an unauthenticated
  REST probe returning 42501 from inside the function rather than PGRST202).
  The panel now
  shows WHAT SHE PUT, not just that she was wrong. One row per wrongly-answered
  item carrying the most recent `chosen` payload, guarded exactly like
  `learner_item_stats` (owns the class AND the learner is in THAT class —
  verified by deleting the membership check and watching test 8 fail).
  `lib/chosenAnswer.ts` turns the opaque jsonb into readable lines and marks
  the parts that were wrong, because on a multi-part item the misconception IS
  which part went wrong. The answer also goes into the authoring brief.
  - **`chosen` is opaque to the database on purpose.** Its shape is per
    interaction type and known only to `grading/grade.ts`; SQL has never known
    what an item is. `describeChosen` is therefore defensive on every path —
    an item re-authored to a different type after the attempt must degrade to
    "not recorded", never throw on a teacher's screen.
  - **The client tolerates 0007 being absent**, because a push deploys before
    Julius pastes the SQL. A failing `learner_last_wrong` is swallowed and the
    rest of the report renders. `chosen: undefined` (never told) is
    deliberately distinct from `chosen: null` (attempt predates the sync).
- **Next up (unstarted):** Capacitor wrap for the App Store / Play Store.
  Julius already holds paid Apple + Google dev accounts from the timesheet
  app, so the cost is sunk. Deliberately deferred while the app still ships
  several times a day — store review turns a 2-minute deploy into 1–3 days.
  The OTP-code sign-in path means native needs no deep-link setup.
- **Deferred with a reason:** a mid-session badge toast. Badges recompute from
  ALL attempts, so firing one mid-session means recomputing after every answer
  — it needs a cheap incremental check first, not a bolt-on.
- **Needs a human, not code:** the BM terminology of Stages 6 and 7 and of the
  balancing-off lessons has never been read against the syllabus — by now that
  is the MAJORITY of the bank (151 of 253 items). It is the part Claude
  authored rather than ported, and it is in front of Ariel.
- **Also open:** Stage 8+ content if the syllabus warrants it, FSRS
  scheduling, multi-tenant authoring UI.

## Gotchas (append-only lesson log)
- 2026-07-27: identity bugs keep recurring in different disguises → anonymous
  auth is per-device AND per-origin, so one person is different users on
  localhost vs the deployed site vs their phone → check `identity.userId`
  FIRST when something looks wrong; the Account screen shows a short id.
- 2026-07-27: emailed auth links 404'd → Supabase DROPS the path from Site URL
  → pass `emailRedirectTo` explicitly (`resolveAppUrl`). Note vite uses
  `base: './'`, so BASE_URL is `'./'` NOT the deploy path — resolve against
  `window.location.href`, never `origin`.
- 2026-07-27: "Copied" shown but clipboard unchanged → `navigator.clipboard`
  is absent/rejects in insecure contexts and the code claimed success anyway →
  never report success without awaiting and checking the result.
- 2026-07-27: push accepted by FCM but never displayed → the service worker had
  registered BEFORE `push-sw.js` existed, so nothing handled the event and it
  was dropped silently → fully close and reopen the PWA to activate the new SW.
- 2026-07-27: teacher roster failed on a PostgREST embed → `class_members` and
  `profiles` have no FK between them (both reference `auth.users`) → fetch
  profiles separately with `.in('id', ids)`.
- 2026-07-27: OTP length is a PROJECT SETTING (this project issues 8, not 6) →
  never name a digit count in UI copy.
- 2026-07-27: PostgREST returns **204, not 403**, when RLS filters all rows out
  of an UPDATE/DELETE → a permissive status does not mean the write landed;
  read the row back.
- 2026-07-27: local PG16 on this Mac fails to start without `LC_ALL=C`
  ("postmaster became multithreaded").
- 2026-07-27: an item renderer's tap handler read its own state from the render
  closure, so several taps in ONE React batch each saw the same snapshot and all
  but the last were discarded (the T-account lost 5 of 6 side assignments) →
  for state a handler ACCUMULATES into, always use the functional updater
  (`setX(x => ...)`), never the rendered value. `userEvent` cannot catch this
  because it awaits a re-render between events, and nor can `fireEvent` — the
  regression test has to dispatch both clicks inside one `act()`.
- 2026-07-28: the teacher roster fetched every review_state row and every
  attempt for every member and rolled them up in JS → PostgREST silently
  TRUNCATES at the project's "Max rows" cap (Supabase default 1000), so the
  numbers would have quietly gone wrong as soon as a class was real — no error,
  just a partial slice → aggregate in Postgres. General rule: any `.in(...)`
  over a growing table is a truncation bug waiting to happen; if a query has no
  natural bound, it belongs in an RPC.
- 2026-07-28: `run.sh` counted assertions with `grep -cx 'f'`, which only
  matches a WHOLE line — so a failing column inside a multi-column row
  (`t|f|t`) was invisible. Fixed with `tr '|' '\n'`; it immediately surfaced 2
  leaderboard assertions that had never been counted (11 → 13).
- 2026-07-28: a migration was pasted in HALVES (a snippet in chat + "copy the
  rest with pbcopy") and only the first half ran — the column and CHECK
  constraint landed, all three functions did not. It looked exactly like a
  stale PostgREST schema cache; `select proname from pg_proc` is what
  distinguished "never created" from "created but not visible to the API" →
  hand over a migration as ONE block, never split, and diagnose via pg_proc
  before blaming the cache.
- 2026-07-29: **`supabase/tests/*.sql` are LOCAL FIXTURES and must never reach
  the SQL Editor.** `harness.sql` fakes the `auth` schema — on prod its
  `create or replace function auth.uid()` would replace the real one, breaking
  every RLS policy in the app, and its `grant select on auth.users to anon`
  is a live exposure. Supabase's own linter caught it ("creates a table
  without enabling RLS ... auth.users") because harness.sql is the only file
  in the repo that creates `auth.users`. Every test file now starts with a
  hard guard that raises if role `supabase_auth_admin` exists, i.e. if it is
  running on a real Supabase database. **Only `supabase/migrations/*.sql` and
  `supabase/maintenance/*.sql` are ever pasted into the SQL Editor.**
- 2026-07-29: `npm run test:integration` signs in ~3 real anonymous users per
  run and can delete its own ROWS but never its own auth USER (that needs the
  admin API, and there is no service_role key here) → the leftovers used to be
  anonymous litter, findable only by footprint, which a real learner who has
  installed the app but not practised yet matches EXACTLY → every suite now
  appends the ids it creates to `.probe-users.local` (gitignored), so cleanup
  is a lookup. `supabase/maintenance/cleanup_probe_users.sql` STEP 1 takes
  ids; STEP 0 is the footprint fallback for runs from before this, and its
  predicate is tested in `supabase/tests/cleanup_test.sql` — a DELETE against
  prod deserves at least what a migration gets.
- 2026-07-28: verifying against prod by creating a throwaway anonymous learner
  in the browser leaves ORPHAN rows — RLS only lets a user delete their own
  data, and a page reload throws the probe's access token away with it →
  stash the probe JWT in `sessionStorage`, not a closure, so cleanup survives
  a reload. There is no service_role key on this machine, so an uncleaned
  probe can only be removed by Julius in the SQL Editor (see
  `supabase/maintenance/cleanup_probe_users.sql` for a guarded pattern —
  match by user id, and refuse to delete anyone who is in a class).
- 2026-07-28: verifying new content in the browser used to mean minting yet
  another throwaway anonymous user on PROD, because the dev server reads the
  real `.env` → added a `localonly` Vite mode (`.env.localonly.local`, blank
  Supabase vars → `SYNC_ENABLED` false → no sign-in at all) and a
  `dev-local-only` entry in `.claude/launch.json` on port 5179. Use it for any
  UI check that does not specifically need the cloud.
- 2026-07-28: to reach a NEW lesson without answering the 30+ items ahead of
  it, seed `reviewState` straight into IndexedDB (`indexedDB.open('kira')`,
  store `reviewState`, rows `{itemId, box: 5, dueAt: <future>, streak, 
  lastResult, updatedAt}`) — `buildQueue` then treats them as done and offers
  the next unseen items in content order.
- 2026-07-28: `get_page_text` and `screenshot` on the preview both read a STALE
  frame — a click looks like it did nothing, and every count-up on the Home
  dashboard reads 0 because rAF is throttled while the pane is not painting.
  Re-read in a SEPARATE tool call before concluding anything, and trust a
  screenshot over the text dump for animated values.
- 2026-07-28: when driving the app from `javascript_tool`, clicking a chip and
  then Submit **in the same JS tick** submits the PRE-click state and looks like
  a bug → it is a test-driving artifact: real clicks are discrete events that
  React flushes individually. Put the two clicks in separate tool calls before
  concluding anything.
