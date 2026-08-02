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
- **Hermetic tests (the CI gate): `npm test`** — 276 passing, no network
- Live-backend tests: `npm run test:integration` — 12 passing, hits real Supabase
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

## Map (only the load-bearing parts)
- `seed_content.json` (repo ROOT) — all 338 items / 22 topics / 56 lessons.
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
- `supabase/migrations/000{1..9}_*.sql` — applied BY HAND via the SQL Editor
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
    stop it being a Kertas 1. Consequence: `t3-journal` and `t4-errors` CANNOT
    appear — they hold only journal_entry/spot_error items — and the real paper
    does examine both. That is a content job, not a code one.
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
  **`BM_REVIEW.md` now exists to make that review finite** — run
  `npm run bm-review` to regenerate it from `seed_content.json`. It is
  GENERATED: never edit the content there, edit the JSON. Three sections, in
  descending order of leverage — mechanical inconsistencies (no Malay needed),
  240 distinct TERMS most-used first (check a term once, fix it everywhere),
  then the full prose. `scripts/bm-review.mjs` also holds the only record of
  WHICH content Claude authored (`CLAUDE_TOPICS` / `CLAUDE_LESSONS`); extend it
  when authoring more.
  - The inconsistency check is deliberately split: Malay marks neither plural
    nor articles, so one BM string covering "Assets" and "An asset" is correct
    Malay and is reported separately as an ENGLISH inconsistency instead. Left
    together, that noise buried the one real finding.
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
