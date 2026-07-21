# Kira

A mobile-first, installable PWA that teaches bookkeeping through short
retrieval-practice sessions. Bilingual (Bahasa Malaysia / English), works
fully offline, aligned to the SPM Prinsip Perakaunan progression.

**Live: https://juliusdx.github.io/kira/**

---

## Learning design

Every feature is tied to a research-backed principle (see
[the build spec](Bookkeeping_App_Build_Spec.md) §2):

| Principle | How Kira implements it |
|---|---|
| **Retrieval practice** | Every session is questions, never passive notes. |
| **Spaced repetition** | A Leitner scheduler resurfaces items at growing intervals (`0 · 1d · 3d · 7d · 21d`). Wrong answers drop to box 1 and reappear the same session. |
| **Worked examples** | A new skill opens with an "I do" card before the first question. |
| **Immediate feedback + self-explanation** | Instant right/wrong with a one-line *why*. On error-prone misses (debit/credit direction, provision-before-vs-after-writeoff) the explanation is withheld behind a "why?" prompt so the learner retrieves the rule first. |
| **Desirable difficulty** | ≤4 new items per session, one skill per micro-lesson, types interleaved within a session. |

## Content

**93 items across 11 topics**, Stages 1–5:

1–2. The accounting equation · debits & credits · journal entries · spot the error
3. Ledger & T-accounts · the trial balance
4. Income statement · statement of financial position
5. Year-end adjustments — accruals & prepayments · depreciation · bad debts & provisions

Seven interaction types: `classify`, `debit_credit`, `numeric`,
`journal_entry`, `t_account`, `spot_error`, `statement_build`.

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
match their entries, statement figures reconcile) and round-trips the grader
against every item's own answer — so a wrong answer key fails the build.

## Getting started

```bash
npm install
npm run dev        # dev server
npm test           # 33 unit + component tests
npm run typecheck
npm run build      # production build + service worker
npm run preview    # serve the built app (use this to test offline/install)
```

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
  components/ screens + one renderer per interaction type
```

`scheduler.ts`, `grade.ts` and `buildQueue.ts` are pure modules with no I/O —
the scheduling and marking rules are unit-tested independently of the UI.

## Deployment

Pushing to `main` runs the tests and build, then deploys to GitHub Pages
([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)). The Pages
source must be set to **GitHub Actions** (not "deploy from a branch"). The Vite
`base` is relative, so the app works at a domain root or under a subpath.

## Not built yet

- **Cloud sync.** Progress is per-device. `src/db/db.ts` already mirrors the
  Postgres tables planned in the spec (§5), and `src/db/data.ts` is the seam a
  sync queue would slot into — but no backend is provisioned. Only needed if a
  learner uses more than one device.
- Stage 6+ content, the backward-fading mechanic (`faded_step`), FSRS
  scheduling, and the multi-tenant authoring UI.
