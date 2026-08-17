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
- **Hermetic tests (the CI gate): `npm test`** — 301 passing, no network
- Live-backend tests: **`KIRA_ALLOW_PROD_TESTS=1 npm run test:integration`** —
  12 passing, hits real Supabase. Without the opt-in a guard refuses and exits
  1 (`scripts/confirm-prod-tests.mjs`), naming the project it would have hit
  (deliberately excluded from CI so deploys don't depend on Supabase uptime).
  Each run signs in ~3 anonymous users it cannot delete; their ids land in
  `.probe-users.local` for the next sweep.
- RLS / SQL policy tests: `./supabase/tests/run.sh` — spins up throwaway local
  Postgres, applies all 9 migrations, runs 22 RLS + 13 leaderboard + 15 push
  + 23 roster + 14 avatar + 13 last-wrong + 19 item-notes + 22 class-insight
  + 19 probe-cleanup assertions.
  **Run this before handing Julius any new migration** — and note the
  probe-cleanup suite guards a destructive hand-run script, not a migration.
- Types: `npm run typecheck`
- Build: `npm run build`
- Deploy: push to `main` → GitHub Actions → GitHub Pages → kira.accme.my

## Working together (two people, since 2026-08-04)
- **`main` is protected.** Branch, PR, let the `build` check pass, merge. The
  check is the same job that deploys, so a PR is held to exactly the bar
  production is. Merging deploys to kira.accme.my in about a minute — there is
  no staging, so a merge IS a release.
- Julius is a repo admin and is deliberately NOT bound by the protection yet,
  so he can still push straight to `main`. That is a concession to cadence, not
  a statement that the rule is optional; it flips to `enforce_admins: true`
  once per-PR previews exist.
- `.github/CODEOWNERS` **routes reviews, it does not partition the code.** It
  locks nothing and grants nothing — either of us may edit any file.
- **`seed_content.json` is the likeliest bad merge in the repo.** One JSON file,
  13k+ lines, 356 items. Two branches both authoring content will conflict, and
  a hand-resolved JSON conflict is exactly how an item id gets duplicated or an
  item silently disappears. Two mitigations, both already in place: the content
  guard reads the RAW file and fails on a duplicate id, and a second test
  asserts the loaded count equals the authored count. Trust neither as a
  substitute for saying out loud who is editing content this week.
- Keep branches SHORT. A long-lived branch against a file-per-topic-less bank
  is what turns a merge into an archaeology exercise.

## Map (only the load-bearing parts)
- `seed_content.json` (repo ROOT) — all 356 items / 22 topics / 58 lessons.
  Content is DATA; adding a stage — or a fading ladder — is a file edit.
  `src/content/loader.ts` imports it directly.
- `src/scheduler/scheduler.ts` — Leitner boxes 1–5, pure, FSRS-swappable
- **`src/items/logic.ts` + `src/items/renderers.tsx` — the ITEM TYPE REGISTRY.**
  Adding an interaction type is: a union member in `types.ts`, a variant in the
  `Item` union, one entry in each map. Nothing else. The switch on `item.type`
  used to live in FIVE places (`grade.ts`, `ItemRenderer`, `itemTypeLabel`,
  `loader`'s `validate()`, `exam/paper`'s `isMcq`) and adding a type meant
  finding all five.
  - **The two maps are split on purpose — do not collapse them.** A single
    registry would import the React components, and `grade()` is pulled in by
    `buildQueue`, the scheduler and the sync layer. Verified by walking the
    import graph: `grade.ts`, `scheduler.ts`, `buildQueue.ts`, `exam/paper.ts`
    and `sync/sync.ts` each reach **zero** `.tsx` files and zero react
    packages. That property is what the purity rule below rests on.
  - `grading/graders.ts` holds the response shapes, the helpers and the eight
    per-type graders. `grade.ts` is now a 16-line dispatch plus
    `export * from './graders'`, so the ~9 modules importing helpers from it
    did not have to move.
  - Two sites still switch on type and are left deliberately: `describeChosen`
    and `ItemPreview`'s `Body`. **Both now fail to compile** on a new type.
    `Body` used to be the exception — it has no declared return type, so
    inference absorbed the fall-through and a new type rendered NOTHING while
    the build stayed green. Closed 2026-08-10 with a `default:` arm handing the
    item to `unhandledType(item: never)`. Verified by declaring a real 9th type:
    tsc reports **five** errors, not the four the registry merge measured — the
    two maps, `describeChosen`, `content.test.ts` and now this line.
    `unhandledType` returns null rather than throwing, because the runtime case
    is an item re-authored to a type newer than the deployed bundle reaching a
    teacher's report, and a progress report that white-screens is worse than
    one missing a panel. `ItemPreview.test.tsx` pins that half.
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
- `supabase/migrations/000{1..9}_*.sql` — applied BY HAND via the SQL Editor
- `supabase/functions/send-reminders/` — Deno Edge Function, deployed via CLI

## Danger zone
- **PRODUCTION IS `ccbioktxfpeqaocjkqpr`** — real learner progress, Ariel's
  account, a real classroom roster, live push subscriptions. A separate DEV
  project is the intended second environment; until one exists in `.env.test.local`
  every network-touching command is production access. Read this first:
  - **Bootstrapping the dev project** is one paste of
    `supabase/maintenance/bootstrap_new_project.sql` (all 9 migrations, ONE
    block, GENERATED by `node scripts/bundle-migrations.mjs` — never
    hand-edited, and a test fails if it drifts from the migrations). Verified
    to apply cleanly to an empty database: 7 tables, 55 functions, 14 policies,
    RLS enabled on 7 of 7. **Never run it against production**, which already
    has 0001–0009 — `create table` has no `if not exists`, so it half-applies
    rather than no-ops.
  - Point dev at it with **`.env.test.local`** (vitest runs as `MODE=test`) and
    **`.env.development.local`** (`npm run dev`). Vite loads `.env` in every
    mode, so the more specific file wins. Both gitignored by `*.local`.
  - The guard then stops firing: `needsOptIn()` requires
    `KIRA_ALLOW_PROD_TESTS=1` **only when the target is the production ref**,
    because a guard that cries wolf on the safe case gets routed around and
    then is not protecting the dangerous one either. An UNKNOWN target counts
    as production — "I could not tell" must never mean "go".
  - **`npm run test:integration` HITS PRODUCTION**, and now REFUSES unless you
    say so: `KIRA_ALLOW_PROD_TESTS=1`. Each run signs in ~28 real anonymous
    users it cannot delete (that needs a service_role key, and there is none on
    this machine); their ids land in `.probe-users.local` so Julius can sweep
    them by hand later. Do not run it casually, and never in a loop.
  - **`npm test` is the safe one** — hermetic, no network, and it is the CI
    gate. Use it freely.
  - **For UI work use `npm run dev -- --mode localonly`** (or the
    `dev-local-only` launch entry, port 5179). It blanks the Supabase vars so
    the app never signs in, which is what stops each check minting another
    orphan account on prod.
  - **For RLS/policy work use `./supabase/tests/run.sh`** — throwaway local
    Postgres, applies every migration, touches nothing real.
  - **Migrations are applied by hand, by Julius, and by nobody else.** Hand one
    over as ONE block; never paste `supabase/tests/*.sql` into the SQL Editor.
  - A separate dev Supabase project is the fix and is not built yet. Until it
    is, treat every network-touching command as production access.
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
  items, taking the bank to 253. (This entry originally said it "finished the
  Form 5 syllabus" — **that was wrong, see 2026-07-30 below.**) Limited
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
  - The teacher's note was NOT persisted at first — copied out or lost, and the
    UI said so. Migration 0008 changed that; see 2026-07-29 (final) below.
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
- **2026-07-29 (last)** — Probe residue swept: 105 empty anonymous accounts
  removed from prod, `auth.users` 135 -> 30. Confirmed burst-shaped before
  deleting (bursts of 12/11/7/6/6/6/4/4/3/3/2/2 with sub-30-second spreads
  from `test:integration`, plus singletons from browser verification on the
  two heaviest dev days). Every survivor holds data, including a user whose
  ONLY asset was a class — the guard that catches that earned its place.
  Prevention: each suite now appends the ids it creates to
  `.probe-users.local` (gitignored), so the next sweep is an id lookup, not a
  footprint match.
- **2026-08-05 — the probe backlog is CLOSED and `.probe-users.local` is EMPTY.**
  33 anonymous accounts removed from prod by id via
  `supabase/maintenance/cleanup_probe_users.sql` STEP 1/2: the 28 minted by the
  accidental `test:integration` run on 08-04, plus 5 older ones (2 `note-*` from
  07-29, 3 `insight-*` from 07-30) nobody had checked. Neither guard fired on
  any of them, and Ariel's / Julius's / the two older Claude-probe ids were each
  verified ABSENT from the delete list beforehand. Swept ids moved to
  `.probe-users.swept.local`, so `.probe-users.local` now means OUTSTANDING only.
  - **A `delete … returning` IS the read-back; a separate count is not needed.**
    It reports the rows actually removed. That is exactly what STEP 3 got wrong —
    it counted `profiles`/`review_state`/`attempts`, which the suite already
    cleans itself, so it reported 0/0/0 for a cleanup that had not happened. Do
    not turn "read back what you care about" into a reflex of always running one
    more query; read back the thing itself.
- **Ariel's real account is `2a54d678…`** — email, in the class, 32 attempts
  against 29 reviews. Two OTHER accounts are named "Ariel" and are Claude's
  probes, not her: `c125f40e…` (186 review rows from **4 attempts**, and a
  `last_review_sync` identical to `last_answered` — a seeded state pushed by
  one sync, not practice) and `1f04ec72…` (named, never practised). Both hold
  data so the sweep spared them, and both sit outside every class so they do
  not touch the roster. **Do not re-raise this as "the roster is missing her
  history" — it was checked and it is not.**
- **2026-07-29 (final)** — The teacher's "better explanation" now survives
  leaving the page. Migration 0008 `item_notes` **APPLIED to prod and VERIFIED
  LIVE** (`itemNotes.integration.test.ts`).
  - **Scoped `(author, item)`, not `(author, learner, item)`.** A better
    explanation for `dc-006` is a better explanation for it whoever missed it;
    per-learner scoping would make a teacher write the same sentence once per
    child. `item_id` carries no FK, like `review_state` and `attempts` — SQL has
    never known what an item is, so a note survives re-authoring.
  - **Author-only, and that is a security decision.** Nobody but the writer ever
    reads a note. Free text written by one user and rendered to another is
    exactly the surface `profiles.avatar` needed a CHECK allow-list to close in
    0006; author-only means there is nothing to moderate and no path onto a
    child's screen. The live integration test's load-bearing assertion is
    therefore "a second account CANNOT read it", not "a note saves" — a table
    created without RLS would pass the second and fail the first, while looking
    like a working feature from the client. It passed against prod.
  - **First thing since 0001 with no SECURITY DEFINER function** — plain
    self-service RLS, so the policy itself is the whole boundary. Verified by
    breaking it two ways: dropping `with check` lets a teacher author rows under
    another user's id (blocked count 4 → 2 plus a `FAIL_` line), and widening
    `using` to true turns 5 assertions false.
  - `updated_at` is set by a trigger, NOT by the client — the opposite of
    `review_state`, on purpose. There the client's clock is the input to
    last-write-wins reconciliation; a note has one writer and no reconcile, so
    the server clock is both simpler and not falsifiable.
  - **The status line never claims a save it did not observe.** The upsert asks
    for the row back and reports `failed` if none returns, because PostgREST
    answers an RLS-filtered write with 204 rather than 403. On failure the old
    behaviour returns exactly where it is still true: the text stays on screen
    and the UI says to copy it out. `src/components/Classes.notes.test.tsx`
    pins this.
  - Saves on BLUR, not per keystroke, and not at all when the text is unchanged
    — reopening a miss to re-read a note must not bump its timestamp.
- **2026-07-29 (robustness pass on the teacher view)** — no schema change.
  - **A removal could fail silently.** `removeMember` trusted the status, but
    PostgREST answers an RLS-filtered DELETE with 204 — identical to success —
    and the call site was the one mutation on the screen with no try/catch. It
    now reads the membership back and the failure surfaces. `leaveClass` got
    the same treatment. An already-absent member is SUCCESS (the caller asked
    for "not in this class"), and a failed read-back is NOT reported as a
    failed delete: it proves nothing either way.
  - **Every teacher screen is now a dated report** — `ReportHeader` shows "as
    of 5 min ago" plus a refresh, and returning from a learner detail re-reads
    the roster so two snapshots cannot disagree. Refreshing deliberately does
    NOT overwrite the teacher's in-progress note.
  - **`sync/classErrors.ts`** maps PostgREST's words onto bilingual strings, as
    `authErrors.ts` does for auth. Unmapped messages KEEP their raw text: this
    screen has no local fallback, so a swallowed error is invisible.
  - An offline banner, because Kira is offline-first everywhere except here and
    never said so.
  - `confirm()` on leave/rotate/remove is knowingly left as-is — browser chrome
    in an installed PWA and off-style, but it works and it is not a robustness
    problem.
- **2026-07-29 (making the teacher view worth opening)** — no schema change.
  The observation behind all of it: every number on that screen described a
  STATE, and none of them told a parent whether to do anything tonight.
  - **`src/app/nextAction.ts`** — one line per learner saying what to DO,
    pure and unit-tested because the ORDERING is the editorial judgement and
    belongs somewhere it can be argued with. Going quiet outranks due reviews
    (spaced repetition not returned to is forgetting on a schedule); accuracy
    only becomes the action once nothing is due, since with reviews
    outstanding the answer is "do the reviews" either way; and an accuracy
    figure under 10 attempts is ignored as noise. The roster now sorts by that
    urgency — the server orders by last-active, which buries the learner who
    has gone quiet for nine days.
  - **Never practised gets a CAUSE, not a task.** That case names the identity
    bug (anonymous auth is per device AND per origin) instead of saying 0%.
  - **`MyNotes.tsx`** — every saved explanation in one place, because a note
    keyed to an item was only reachable by finding the learner who missed that
    item. `listMyNotes` is explicitly capped at 200 and REPORTS being capped;
    "naturally bounded" is exactly what was said about the roster query
    PostgREST silently truncated.
  - **`buildBriefBundle`** — every recent miss as one request. One brief per
    clipboard trip suits the miss you happen to be reading and is useless for
    the actual job. Separated by a rule, not a blank line, because the chat
    window it gets pasted into collapses whitespace.
- **2026-07-29 (class insight)** — Migration 0009 `class_activity` +
  `class_item_stats` **APPLIED to prod and VERIFIED LIVE on 2026-07-30**
  (`classInsight.integration.test.ts` — including that a member cannot read the
  class figures and that owning some other class grants nothing here).
  - **`class_activity` answers "did she come back", which mastery cannot.**
    Seven booleans per member, oldest first. It counts DAYS, not attempts —
    a strip counting sessions would make one long evening look like a week of
    steady work. The timezone comes from the BROWSER, because the strip is read
    on the teacher's screen and "today" should mean their today; an
    unrecognised zone falls back to UTC rather than raising, since a progress
    report should not fail to load over a locale string.
  - **`class_item_stats` returns ITEMS, not skills, on purpose.** Skill tags
    live in `seed_content.json` — client data — so the roll-up happens in TS
    through the SAME `weakestSkills()` the per-learner view uses. One
    definition of "weak" rather than two that drift. This is the same rule that
    keeps `chosen` opaque in 0007 and `item_id` FK-free in 0008: SQL has never
    known what an item is.
  - It also returns a DISTINCT LEARNER count per item, which is the number that
    turns a statistic into a plan: one learner missing an item six times is a
    conversation with that learner; four learners missing it once each is a
    reteach, and totals alone cannot tell them apart.
  - Both are owner-only — unlike `learner_item_stats` there is no per-learner
    argument, because the answer covers the whole class. Verified by breaking
    them: dropping `owns_class` produces 3 `FAIL_` lines and drops blocked 5→2;
    dropping the `class_members` join turns 5 assertions false, including the
    one asserting an outsider's answers never reach the class figures.
  - The client tolerates 0009 being absent, like 0007 and 0008 — the strip and
    the weak-spots card simply do not render, and the roster is unaffected.
    That tolerance is now moot on prod but still correct for a fresh project.
- **2026-07-30 — the bank does NOT cover the Form 5 syllabus.** Checked against
  the real SPM 2024 papers (3756/1 and 3756/2). The docs claimed completeness
  from Stage 7 onwards; that claim was never tested against an actual paper and
  it is false. Examined in 2024 and ABSENT from all 253 items:
  break-even (Titik Pulang Modal, K1 Q39) · petty cash / imprest (K1 Q8) ·
  source documents — invoice, debit note, credit note, delivery note (K1 Q5–Q6)
  · books of first entry and which journal takes what (K1 Q7) ·
  **reducing-balance depreciation** (K1 Q16, K2 Q2(iii), K2 Q3(iv)) ·
  **disposal of a non-current asset** (K1 Q17) · partnership dissolution and
  the realisation account (K1 Q32) · inventory at the lower of cost and market
  (K1 Q11, K2 Q2(i), K2 Q6) · cooperatives (K2 Q1a) · the Partnership Act 1961
  s.26 (K2 Q1e) · accounting bodies MIA/MASB (K1 Q2) · share oversubscription
  (K1 Q34) · loose tools by revaluation (K2 Q3(v)).
  - Verified structurally, not just by keyword: `t10-depreciation` holds only
    straight-line + its ladder, `t17-partnership` only capital-vs-current +
    appropriation, `t19-manufacturing` has no break-even.
  - **Reducing balance and disposal are the two that matter most** — both are
    heavily examined and both sit inside a topic Kira already teaches, so a
    learner has every reason to think that topic is covered.
  - Consequence for any mock-exam work: a paper generated from today's bank
    would silently omit these and hand back a flattering score.
- **2026-07-30 (closing the two sharpest gaps)** — 23 items / 3 lessons into
  `t10-depreciation`, bank now **276**. Content-only, no schema.
  `l44-reducing-balance` drills the thing the exam actually tests: the rate
  applies to the CARRYING AMOUNT, not to cost, so the charge falls every year.
  Its hardest item is the 2024 shape — cost 12,000, accumulated 3,200, 5% —
  where the straight-line answer (600) is one of the wrong options and the
  right one is 440. `l45-disposal` is proceeds vs carrying amount, the three
  transfers into the Disposal account, and the direction of a profit (credited)
  against a loss (debited). `l46-faded-disposal` is the 15th ladder, 1 → 3 → 5
  blanks. New skill tags `reducing-balance` and `disposal`, labelled in
  `loader.ts`. **BM is Claude's, so all three lessons are in `BM_REVIEW.md`
  (scope is now 174 items).**
  - Verified in the browser under `localonly`, seeding IndexedDB to reach them:
    worked example, numeric grading, the ladder's mixed number/choice steps and
    its distractor pool all render, and the single-blank ladder commits on tap
    as the submit rule says it should.
- **2026-07-30 (gap list, batch 2)** — 26 items / 4 lessons, bank now **302**.
  Content-only, no schema. Taken in order of what the papers actually weight.
  - **New topic `t22-documents`, inserted at order 3** — source documents,
    books of first entry, petty cash & the imprest. That is 4 marks of Kertas 1
    (Q5–Q8) and it is FOUNDATIONAL material that was missing entirely, so it is
    placed between debits/credits and journals rather than appended. **Every
    later topic was renumbered +1**; safe, because `review_state` is keyed by
    item id and never by order.
  - The traps are the content: a credit purchase of a VAN is not "purchases"
    and a service supplied on credit is not "sales" (both general journal), a
    statement of account is not a source document, and the imprest float is
    "balance in hand + reimbursement", which is how the exam asks it.
  - **`l50-inventory-valuation`** into `t7-income-statement` — lower of cost
    and market, compared LINE BY LINE not on totals, plus which way an
    overstatement pushes cost of sales and gross profit. One mark in Kertas 1
    but it moves the answer inside two big Kertas 2 questions.
  - New skill tags `source-documents`, `books-of-first-entry`, `petty-cash`,
    `inventory-valuation`, labelled in `loader.ts`. BM is Claude's — scope of
    `BM_REVIEW.md` is now 200 items.
  - **Open question for Julius, surfaced by the review doc:** "Receipt" now has
    two BM renderings — `Resit` (the document, sd-*) and `Terimaan` (money in,
    cb-*). Both look right in their own context and a learner never meets both
    in one question, so this is an ambiguity in the ENGLISH rather than a BM
    error. Left as-is deliberately.
- **2026-07-30 (gap list, batch 3 — the list is CLOSED)** — 36 items / 6
  lessons, bank now **338**. Content-only. All 13 gaps the SPM 2024 papers
  exposed are now taught; re-probed and every one comes back present.
  - `l51-no-agreement` + `l52-dissolution` into `t17-partnership` — section 26
    (equal shares however unequal the capitals, no salary, no interest on
    capital, 5% only on a LOAN) and the realisation account. The s.26 item
    with unequal capitals is the trap: splitting 3:1 by capital is the
    tempting wrong answer.
  - `l53-break-even` into `t19-manufacturing` — contribution per unit, fixed
    costs ÷ contribution, and what moves the point. Its numeric answers are
    UNIT counts, so they carry `unit`/`unit_ms`/`unitAfter` (`4000 unit`).
  - `l54-revaluation-method` into `t10-depreciation` — opening + purchases −
    closing, the third depreciation method and the one used for loose tools.
  - `l55-share-issue` into `t18-limited-companies` — oversubscription, the
    refund, and why preference ranks before ordinary.
  - `l56-entities-and-bodies` into `t1-equation` — sole trader / partnership /
    company / cooperative by ownership and liability, one-member-one-vote, and
    MASB (writes the standards) against MIA (regulates the accountants).
  - New skill tags `revaluation-method`, `dissolution`, `break-even`.
    `BM_REVIEW.md` scope is now **236 items** — the majority of the bank, all
    of it Claude's BM and still unread against the syllabus.
- **2026-07-30 (mock exam shell)** — a Kertas 1-shaped paper: 40 MCQ, 75
  minutes, nothing marked until it is handed in. `src/exam/paper.ts` is pure
  (blueprint, seeded selection, scoring); `src/components/Exam.tsx` is the
  shell; Dexie goes to **version 2** with an `examRuns` store.
  - **MCQ only.** `classify` + `debit_credit` are the single-answer types; a
    T-account in a 75-minute 40-question paper would wreck the time budget and
    stop it being a Kertas 1. Consequence at the time: `t3-journal` and
    `t4-errors` CANNOT appear — they hold only journal_entry/spot_error items —
    and the real paper does examine both. That is a content job, not a code
    one. **Done on 2026-08-03, see below.**
  - **`BLUEPRINT` is modelled on the 2024 paper, not on what Kira happens to
    hold**, and a test asserts it sums to 40 and that every named topic can
    actually supply its allocation. A shortfall is redistributed so a paper is
    never quietly 37 questions long.
  - **The paper is rebuilt from its seed rather than stored.** `buildPaper` is
    deterministic (mulberry32, never Math.random), so the review screen
    regenerates the same 40 questions. Storing both would let them disagree.
  - **NOT SessionScreen with a flag, and NOT ItemRenderer.** A session has a
    combo, worked examples, a self-explanation gate and re-queues misses —
    all meaningless or wrong under exam conditions. And choice items commit on
    tap, which is right for drilling and wrong here: a real paper lets you
    change your mind. `ExamChoices` is selection-only, and tapping the chosen
    option again clears it.
  - **Answers become ordinary attempts; blanks do not.** A mock is retrieval
    practice under the hardest conditions, so it should move the schedule and
    it reaches the teacher's roster for free. But an unanswered question is a
    fact about the CLOCK, and dropping that item to box 1 would punish the
    wrong thing. Verified in the browser: 30 answers, 10 blanks, 30 attempts.
  - Exam runs are **local-only** — the answers sync as attempts, the paper as
    an event does not. That needs a table and a migration, worth doing once a
    mock has actually been sat.
- **2026-07-30 (Penghutang/Pemiutang → Akaun Belum Terima/Bayar)** — Julius's
  call, after the SPM cross-check showed neither 2024 paper uses the old terms
  anywhere. 111 occurrences swept across the WHOLE bank, including Julius's own
  ported Stages 1–5, plus `ACCOUNT_GLOSSARY_MS` and the `receivable` skill
  label in `loader.ts`.
  - **Compounds had to be collapsed, not substituted.** `Akaun Penghutang
    Perdagangan` → `Akaun Belum Terima`, not `Akaun Akaun Belum Terima…`. The
    script asserts zero `Akaun Akaun` afterwards. Likewise the paper has no
    qualifier: "trade receivables" is just `Akaun Belum Terima`.
  - **5 uses deliberately KEPT as `pemiutang`, and they are the interesting
    part.** Where the word means the PEOPLE owed money rather than the ledger
    account, an account name is not Malay: "an Akaun Belum Bayar can claim his
    personal assets" is nonsense, and the dissolution payment order ranks
    claimants, not accounts. Three were protected up front; **two more were
    only found by reading the output** — a mechanical sweep produces valid JSON
    and bad Malay, and the guard for that is a person-verb grep
    (`boleh|membayar|menuntut|yang pasti`) plus actually reading it.
  - `BM_REVIEW.md` still reports those 5 as a clash, which is right — they are
    visible for Julius to overrule rather than hidden by an exception list.
- **2026-07-30 (Amaun bawaan → Nilai buku)** — Julius's call, same reason: both
  2024 papers say `Nilai buku` and we were using BOTH terms (20 vs 4), so it
  was wrong twice over. 20 occurrences switched, case preserved.
  `Amaun boleh susut` (depreciable amount) is a DIFFERENT term and was left
  alone — the word boundary is what keeps them apart.
  - **This exposed a limit of the section-0 checker: it only compares short
    LABELS, so a term living in prose is invisible to it.** The English side
    now says "carrying amount" 21× and "book value" 4× (all five of the latter
    in `l52-dissolution`, which was authored separately), and nothing in the
    review doc flags it, because neither appears as an option or a step label.
    Worth fixing in `scripts/bm-review.mjs` if another prose-level clash turns
    up; noted here so the next session does not trust section 1 to be complete.
  - **Resolved the same day, Julius's call: teach the equivalence.** The four
    LABELS a learner reads as a heading or picks as an answer now carry both
    names — `Book value (carrying amount)` / `Nilai buku (amaun bawaan)` — and
    the three worked examples that DEFINE the term say outright that the two
    are one figure and the exam uses the first. Everywhere else uses the single
    primary term: repeating the parenthetical through twenty prompts is noise,
    not teaching. `rb-101`'s `answer` moved with its option, which the content
    guard's `answer ∈ options` check and grader round-trip both cover.
  - **A global replace ate the word it was meant to teach.** Step 3 of the
    script ran after step 2 had inserted the teaching sentences, and only the
    exact paired string was protected — so "Book value and carrying amount are
    two names…" became "Book value and book value…". Valid JSON, nonsense
    English, tests all green. Found by reading the output, same as the
    `pemiutang` person-sense cases. **Order a content sweep so the teaching
    text is written LAST, or protect it explicitly.**
- **2026-07-30 (Saham → Syer)** — Julius's call. Both 2024 papers say `Syer
  Biasa` / `Syer Keutamaan` / `sesyer`, and we already used both spellings
  (14 `saham` against 33 `syer`), so it was the exam's word AND an internal
  inconsistency. 14 switched, plus the `share-capital` skill label in
  `loader.ts` (`Modal saham` → `Modal Syer`).
  - **A blind spot the two earlier sweeps happened to dodge: ALL-CAPS
    emphasis.** One item wrote `setiap SAHAM` to mirror the English `per
    SHARE`, and a `/Saham/g` + `/saham/g` pair does not touch it. Audited the
    earlier switches for the same shape — no `PENGHUTANG`, `PEMIUTANG` or
    `AMAUN BAWAAN` existed, so they were unaffected. **Any future term sweep
    needs the all-caps case, or a case-insensitive match with case-aware
    replacement.**
  - Section 0 is now down to 3 clashes, and two of them are DELIBERATE: the 5
    person-sense `Pemiutang`, and the 6 `Amaun bawaan` that make up the paired
    `Nilai buku (amaun bawaan)` labels and teaching lines. Only
    `Pengagihan Untung` vs `Pengasingan Untung Rugi` is untouched.
- **2026-07-30 (Pengagihan Untung → Pengasingan Untung Rugi)** — Julius's call,
  the last real clash on the list. 17 edits, and unlike the three sweeps before
  it these were written out ONE BY ONE with each anchor asserted, because a
  blanket regex had already produced bad Malay three times that day. Two senses
  kept apart the way the paper uses them: the ACCOUNT or statement line is
  `Akaun Pengasingan Untung Rugi` / `Pengasingan Untung Rugi` (K1 Q31 prints
  the line exactly so), the PROCESS in prose is `pengasingan untung`.
  - It also closed a section-1 inconsistency for free: both `l29` and `l34` are
    titled "Fading the Appropriation" in English and had drifted to two
    different BM titles. They are now identical, which is what the English says.
  - **Section 0 is now down to 2 clashes and BOTH are deliberate** — the 5
    person-sense `Pemiutang` and the 6 `Amaun bawaan` inside the paired
    `Nilai buku (amaun bawaan)` labels. There are no accidental clashes left
    against the 2024 papers. Extending `SPM_TERMS` with another year's paper is
    what would find more.
- **2026-07-30 (NEXT SESSION'S TARGET) — Mike's SPM corpus.**
  `https://github.com/whitegreenstudios/spm-practice` (whitegreenstudios), a
  scrape → OCR → question-bank pipeline over Malaysian SPM papers. Surveyed
  this session, NOT yet used. What is actually there:
  - `papers_list.json` catalogues **2,480 papers**, of which **255 are
    `prinsip-perakaunan`** — 2021 (64), 2022 (43), 2023 (55), 2024 (37), 2025
    (56), across ~14 states. That is a far bigger corpus than the two 2024
    papers `SPM_TERMS` was built from.
  - **They are TRIAL papers** (`edukaji.my/spm-trial-paper/…`), i.e. state mock
    exams, not Lembaga Peperiksaan's own. The repo tags trial vs
    `spm-past-year` and keeps them apart on purpose. **A trial paper is a
    weaker authority on terminology than the real one** — useful for frequency
    and coverage, not for overruling a real paper.
  - **The accounting papers are NOT extracted.** The committed markdown corpus
    and the 5,784-question `data.json` cover Add Maths, Sejarah, BM, Pendidikan
    Islam and English only — no Perakaunan. Source PDFs are deliberately
    gitignored (~3.5 GB, and third-party copyright), so using these means
    re-running the scrape + extract stages ourselves.
  - Three plausible uses, in descending confidence: **extend `SPM_TERMS`**
    (biggest, cheapest win — more years and states of BM terminology to check
    ours against); **make `BLUEPRINT` empirical** rather than modelled on one
    paper, by counting real topic frequency across many papers; and calibrate
    the gap list against more than one year.
  - **Copyright is unchanged by this.** The repo excludes the PDFs for exactly
    that reason. Use the corpus to CHECK our terminology, coverage and
    weighting — never to copy questions into `seed_content.json`, which ships
    in a public bundle and is heading for app stores.
- **2026-08-03 (the mock paper can finally examine journals and errors)** — 18
  items / 2 lessons, bank now **356**. Content-only, no schema. This closes the
  gap the mock-exam shell shipped with and named in its own comment: a paper
  could not ask about double entry or spotting an error, because `t3-journal`
  and `t4-errors` held nothing but `journal_entry` and `spot_error` items.
  - They were also the **two thinnest topics in the bank** — 7 and 3 items
    against 12–41 everywhere else — so this was a teaching hole as much as an
    exam one. They are now 17 and 11.
  - **`l57-which-account`** into `t3-journal`, 10 items — given a transaction,
    which account is debited or credited. The traps are the content: a credit
    customer paying is NOT a sale (recording it again counts one sale twice),
    a computer bought on credit for the office is not "purchases", carriage
    inwards is not folded into purchases, and returns inwards/outwards are
    opposite directions. Drawings, returns and carriage are all K1 Q10/Q13/Q14
    material that the bank had never asked about directly.
  - **`l58-diagnose`** into `t4-errors`, 8 items — say what is wrong BEFORE
    correcting it. Four options every time: sides reversed, wrong account,
    amounts differ, or nothing is wrong. **One item's answer really is
    "nothing is wrong"**, which is what keeps the other seven honest, and the
    amounts-differ item is the only fault on the list a trial balance catches.
  - **Both lessons go FIRST in their topic**, existing lessons shifted +1 —
    naming the account is a smaller step than building the whole entry, and
    diagnosing a fault is smaller than correcting it. Safe for the same reason
    the t22 insertion was: `review_state` is keyed by item id, never by order.
  - **BLUEPRINT rebalanced within the recording-cycle block**, not across the
    paper: t3 gets 2 and t4 gets 1, funded by one each off the three largest
    cycle topics (t1 3→2, t22 4→3, t6 3→2). The opening cycle keeps its
    modelled 12 questions and every later topic keeps the count the 2024 paper
    gave it — journals are not paid for with a partnership mark.
  - **The new test is the point, not the counts.** `leaves out no topic the
    bank can actually examine` fails if any topic holding MCQ items is missing
    from the blueprint. Nothing caught the original omission: the paper was a
    full 40 questions and every test was green. Verified by deleting t4-errors
    from the blueprint and bumping t5 to keep the sum at 40 — the new test is
    the ONLY one that fails.
  - Verified in the browser under `localonly`: both lessons render in BM and
    EN, commit on tap, the long "what is wrong" options wrap cleanly on a
    375px viewport, the wrong-answer path fires the self-explanation gate, and
    a real sat paper asks je-106 at **question 8 of 40** and err-011 at **9**.
  - BM is Claude's, so both lessons are in `BM_REVIEW.md` (scope now **254
    items**). Four of the new terms are the exam board's own — `Ambilan`,
    `Pulangan masuk`, `Pulangan keluar`, `Angkutan masuk` all come straight
    from `SPM_TERMS`. Section 0 is unchanged at 2 deliberate clashes.
  - **Resolved the same day, Julius's call: `Trade Payables` everywhere a
    LABEL names the account.** 8 edits — the two classify prompts that are
    nothing but the account name (bs-003, bs-008), three statement lines
    (sb-002, ir-201 ×2), and three faded-step labels that lead with it
    (fd-301..303). `BM_REVIEW.md` §1's English-side list went 6 → 4 and both
    Trade entries are gone; the survivors are the plural/singular category,
    which is a different thing.
  - **PROSE was deliberately left alone — 9 occurrences**, listed by the
    script rather than hidden: `clf-008`, `bd-101/102/104`, `bd-302`,
    `fd-301..303` scenarios, `ra-008`. Every one is either sentence-initial
    ("Trade receivables are RM50,000 before writing off a bad debt") or
    lowercase mid-sentence ("deducted from trade receivables"), so the capital
    there is sentence case and not an account name. Capitalising inside a
    sentence is a separate style decision over Julius's ported Stage 1–5
    prose. Note `ra-008` reads "Trade receivables RM30,000 and credit sales
    RM365,000" — capitalising one and not "credit sales" would be worse.
  - **None of the 17 occurrences was ever an option or an answer**, so there
    was no answer-key coupling and no grader risk; they are all prompts,
    labels, scenarios and explanations. The label edits were written as
    explicit (item, path, from, to) tuples with every anchor asserted, and the
    script refuses to write if a label-shaped occurrence survives.
- **2026-08-08 (item types stop being scattered code)** — `src/items/logic.ts`
  + `src/items/renderers.tsx`, authored outside this repo as a patch and
  reviewed in [PR #2](https://github.com/juliusdx/kira/pull/2) (`a158c76`).
  See the Map entry above for what it is and what not to collapse.
  Content was already data; item TYPES were still code in five places.
  - **What was verified, beyond the suite going 295 → 300.** `isMcq` changed
    from naming `classify`/`debit_credit` literally to asking the registry for
    `singleChoice`, which the whole mock paper rests on — checked both that
    `singleChoice` is set on exactly those two types AND that across all 356
    items not one disagrees with the old predicate (184 MCQ items). The content
    guard now delegates to per-type validators, so `je-101`'s answer was
    corrupted to prove it still fails with the same message, then restored
    byte-identical. And the "adding a type is two entries" claim was tested by
    declaring a real 9th type: exactly four compile errors — the two maps,
    `describeChosen`, and `content.test.ts`'s `correctResponse`.
  - **Browser-verified under `localonly`, all 8 types in one session** by
    seeding one item of each as due. Every badge comes from the registry label,
    every type graded correctly, 8/8 and no console errors. The submit rule
    still holds (a single-blank `faded_step` commits on TAP; the four
    multi-part types wait for Check). And nothing was lost to React batching —
    the T-account reached Debit 21,500 / Kredit 12,000 with all three sides
    landing, the statement 51,000 / 22,000 with all five lines.
  - **Merged with `--admin`, so NO approval was recorded.** GitHub refuses
    self-approval and the PR was opened under Julius's own account, so the
    1-approval rule was bypassed rather than satisfied. Consequence worth
    knowing: 14 files of outside-authored code reached production with no
    second human reviewer. To get a real review next time, push the branch and
    let Julius open the PR — then a non-author can actually approve it.
- **2026-08-09 — the Science sibling moved out. It is `juliusdx/kaji` (PRIVATE).**
  Kaji (*mengkaji*, to investigate) is a trilingual KSSR Sains app for primary,
  sharing Kira's architecture. It will be served from `kaji.accme.my`.
  **Nothing about it belongs in this repo any more** — the decision record, the
  KSSR docs, the diagram trace pipeline and its provenance guard, and the pure
  logic for shared option banks and sequence scoring all live there now. If a
  future session finds itself designing Science content or item types in Kira,
  it is in the wrong repo.
  - What left, and why none of it was Kira's: `docs/KAJI_DECISIONS.md` +
    `docs/sains/`, `kaji/` (2 pure modules, 40 tests), and 5 scripts —
    `extract-diagram.py` plus the `diagram-provenance` / `diagram-scan` /
    `check-diagrams` guard. Kira has no diagrams (exactly one `<img>` in the
    whole app) and no item has ever shared an option pool with the next one, so
    all of it was dead weight here. `npm test` went 354 → **300**, back to the
    count right after the registry merge, and `check:diagrams` is gone from
    `package.json`.
  - **The registry refactor above WAS Phase 1 of Kaji's plan**, done before
    anyone connected the two. That is the only overlap that ever mattered: the
    same registry is what lets Kaji add its own item types cheaply, which is why
    forking Kira rather than deleting from it was the wrong instinct.
  - Kaji is **private**, so it has NO branch protection — impossible on the free
    plan. That is a deliberate trade for keeping GitHub Pages optional, since
    free Pages is the only thing that required a public repo.
- **Next up (unstarted):** Capacitor wrap for the App Store / Play Store.
  Julius already holds paid Apple + Google dev accounts from the timesheet
  app, so the cost is sunk. Deliberately deferred while the app still ships
  several times a day — store review turns a 2-minute deploy into 1–3 days.
  The OTP-code sign-in path means native needs no deep-link setup.
- **Deferred with a reason:** a mid-session badge toast. Badges recompute from
  ALL attempts, so firing one mid-session means recomputing after every answer
  — it needs a cheap incremental check first, not a bolt-on.
- **Needs a human, not code:** the BM terminology Claude authored has never
  been read against the syllabus by someone who reads Malay — that is now
  **254 of 356 items**, the clear majority of the bank, and it is in front of
  Ariel. Section 0 (the SPM cross-check) is CLEAN as of 2026-07-30, but it only
  covers the ~48 terms transcribed from one year's papers; sections 1–3 are
  still the read-through.
  **`BM_REVIEW.md` now exists to make that review finite** — run
  `npm run bm-review` to regenerate it from `seed_content.json`. It is
  GENERATED: never edit the content there, edit the JSON. Three sections, in
  descending order of leverage — mechanical inconsistencies (no Malay needed),
  240 distinct TERMS most-used first (check a term once, fix it everywhere),
  then the full prose. `scripts/bm-review.mjs` also holds the only record of
  WHICH content Claude authored (`CLAUDE_TOPICS` / `CLAUDE_LESSONS`); extend it
  when authoring more.
  - **`BM_REVIEW.md` section 0 checks our BM against the SPM 2024 papers**
    themselves (`SPM_TERMS` in the script, transcribed from 3756/1 and 3756/2).
    This is the only part of the review that needs NO Malay to act on: where
    our word differs from the exam board's, the board wins. It found 6 clashes
    on first run, the biggest being **`Penghutang`/`Pemiutang` (64 uses) where
    both 2024 papers say `Akaun Belum Terima`/`Akaun Belum Bayar`** — which
    reads like a syllabus generation of drift. **Julius decided 2026-07-30:
    switched everywhere** — see below. Extend `SPM_TERMS` whenever another
    paper is read.
  - The inconsistency check is deliberately split: Malay marks neither plural
    nor articles, so one BM string covering "Assets" and "An asset" is correct
    Malay and is reported separately as an ENGLISH inconsistency instead. Left
    together, that noise buried the one real finding.
- **Also open:** Stage 8+ content if the syllabus warrants it, FSRS
  scheduling, multi-tenant authoring UI.

## Gotchas (append-only lesson log)
- 2026-08-04: **a guard that fails OPEN is worse than no guard, because it
  reads as protection.** A new `scripts/confirm-prod-tests.mjs` was added in
  front of `test:integration` and wrapped its logic in the conventional
  run-as-CLI check, `import.meta.url === \`file://${process.argv[1]}\``, so the
  module could also be imported by its own test. The check was FALSE, the body
  never ran, `node scripts/confirm-prod-tests.mjs` exited 0, `&& vitest` ran,
  and **28 probe users went into Ariel's production project** — the exact harm
  the guard was written to prevent, caused by the guard's own plumbing.
  Two independent reasons it was false, either sufficient: npm passes
  `argv[1]` **relative** (`scripts/confirm-prod-tests.mjs`), and **this repo's
  path contains a SPACE**, which `import.meta.url` percent-encodes to `%20`
  while string concatenation does not. → Never compare a URL to a path by
  concatenation; use `fileURLToPath`. Better, **do not gate a guard on
  detecting how it was invoked at all**: put the decision in a pure importable
  module and let the CLI file be unconditional, so there is no branch that can
  evaluate wrong. A guard must fail CLOSED.
- 2026-08-04: **the unit tests for that guard were green the entire time.**
  They tested `isAllowed()`, which was always correct — the broken part was the
  script package.json actually invokes. → test a guard by SPAWNING it the way
  its caller does (relative path, real cwd) and asserting the exit code. Same
  shape as the duplicate-item-id lesson below: a guard tested through the layer
  that normalises the fault cannot see the fault. Verified by reintroducing the
  bug and watching 4 subprocess assertions fail with `expected +0 to be 1`.
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
- 2026-07-29: **"holds data" and "is a real learner" are not the same test.**
  The probe sweep guarded on owning something, which was right, but it would
  happily have called a seeded probe a person. The discriminator is the
  ATTEMPTS-TO-REVIEWS RATIO: genuine practice yields >= 1 attempt per review
  row (usually more, items get re-answered), while a seeded or synced state
  yields hundreds of review rows from a handful of attempts. Check the ratio
  before concluding anything about whose account is whose.
- 2026-07-29: Julius uses the clipboard for his own work, so `pbcopy` is a
  BAD handover channel — a script copied for him does not survive the trip.
  Put SQL in the message, and commit it somewhere under
  `supabase/maintenance/` so it outlives the chat.
- 2026-07-29: a guard keyed on a Postgres ROLE (`supabase_auth_admin`) is
  CLUSTER-wide, so one stray `create role` anywhere on the machine refused
  every local test run — including the scratch database used to test the
  guard itself. Key a "is this production?" check on a per-DATABASE fact
  instead: `auth.users` having an `encrypted_password` column.
- 2026-07-29: Claude put runnable-looking SQL in a PROSE WARNING — a fenced
  block quoting `create or replace function auth.uid()` and
  `grant select on auth.users to anon` to explain what would be dangerous —
  and Julius pasted it into the SQL Editor, reasonably, because everything
  else Claude had handed over that day was meant to be pasted. Nothing ran:
  with no semicolon the two lines parse as ONE malformed statement, so
  Postgres rejected the batch (`42601 syntax error at or near "grant"`) and
  executed none of it. Verified by reproducing it against a local database —
  `auth.uid()` unchanged, zero grants. → **Never quote executable SQL to make
  a point.** Describe it in words, or defang it. A fenced SQL block in this
  project is an instruction to paste.
- 2026-07-29: **`supabase/tests/*.sql` are LOCAL FIXTURES and must never reach
  the SQL Editor** — `harness.sql` fakes the `auth` schema, so on prod its
  `auth.uid()` replacement would break every RLS policy in the app and its
  grant on `auth.users` would be a live exposure; the `_test.sql` files insert
  into `auth.users` and `cleanup_test.sql` deletes from it. This has never
  actually happened (see above — that was a false alarm), but nothing stopped
  it either, so every test file now opens with a hard guard that raises if
  role `supabase_auth_admin` exists, i.e. if it is running on a real Supabase
  database. **Only `supabase/migrations/*.sql` and `supabase/maintenance/*.sql`
  are ever pasted into the SQL Editor.**
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
- 2026-07-30: **a duplicate item id used to be invisible to the content guard.**
  A new fading ladder reused `fd-1401..1403`, already taken by the cash-budget
  ladder. Every test stayed green and three items silently vanished, because
  `loader.ts` builds its index as a `Map` keyed by item id — the duplicate
  OVERWRITES the first, so `ALL_ENTRIES` never contains a collision and the
  existing "unique item ids" assertion was comparing a deduplicated list
  against itself. It could not fail. → the guard now reads
  `seed_content.json` DIRECTLY, and a second test asserts the loaded count
  equals the authored count so any silent loss shows up. An item id is the key
  of `review_state`, `attempts` AND `item_notes`, so a collision does not just
  lose a question, it merges two questions' progress into one learner row.
  General rule: a guard that reads its subject through the very code that
  normalises the fault cannot see the fault.
- 2026-07-30: to browser-verify NEW content in `localonly`, do not hand-build
  the id list — the Vite dev server serves `/seed_content.json`, so the page
  can `fetch` it and seed `reviewState` for every id except the lesson under
  test. Note `window.*` set before a `navigate` is gone after it; re-fetch
  inside the same call that seeds.
- 2026-07-29: **the teacher screens cannot be browser-verified in `localonly`.**
  `.env.localonly` blanks the Supabase vars, `SYNC_ENABLED` goes false, and the
  entire classroom UI is hidden — there is no Classes entry on the Progress
  screen at all. So the localonly mode that exists to avoid minting prod users
  cannot exercise the one surface that needs the cloud. Verify teacher UI with
  component tests against the real component (see `Classes.report.test.tsx`),
  and treat a browser check of the roster as something that costs a prod
  account. Do not go looking for the screen and conclude it is broken.
- 2026-07-29: **a hook that returns a fresh function each render silently turns
  a mount effect into an every-render effect.** A new `useErrorText()` closed
  over `t` from `useKira()`, which is a NEW function on every render, so the
  `useCallback` that fetched was new every render, so its `useEffect` re-ran
  every render — a reload loop against the RPC that also reset screen state
  under the user. It surfaced as an unrelated NOTE test failing, and the
  regression test measured 11,067 calls where 2 were expected. → any hook
  whose result becomes a dependency of a fetch must be referentially STABLE:
  hold the changing value in a ref and give `useCallback` an empty dep array.
- 2026-07-29: a SQL test that said `set role postgres` to escape RLS failed on
  this Mac, where the superuser is `julius` — and `\set ON_ERROR_STOP on` made
  that abort the whole file, so `run.sh` exited non-zero with the suite's own
  summary line never printed. `reset role` is the portable form AND the better
  assertion: as the owning role RLS does not apply, so it checks a row is GONE
  rather than merely invisible.
- 2026-07-29: `run.sh` guards each suite with a minimum count of `blocked_`
  lines, because a negative case that stops raising returns no row and so
  cannot be caught by counting `f`. That minimum must equal the real number of
  raising cases — set it too high and the suite fails green work; too low and
  it stops meaning anything.
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
