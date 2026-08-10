# `kaji/` — Kaji code, living temporarily in the Kira repo

**Nothing in `src/` imports this, so none of it reaches Kira's bundle.** It is here
to be typechecked and tested against a real suite until the Kaji repo exists, at which
point this directory moves wholesale and this README goes away.

Kira has no use for any of it. Kira's schema is `Topic → Lesson → Item` and no Kira item
has ever shared an option pool with the next one — 21 lessons contain items with *identical*
pools, but they are duplicated, never consumed from a common bank. Wiring a `part` type into
Kira's live registry would be dead code plus a dead renderer in an app a real learner uses
daily, so the logic is built and proven here and wired up in Kaji.

## What is here

| File | What |
|---|---|
| `parts.ts` | Shared option banks — the WA0065 problem. Pure: no React, no I/O, no storage. |
| `sequence.ts` | Ordering questions, scored on adjacent-pair agreement. Pure. |

## Why a Part is a composite ITEM, not a layer

`KAJI_DECISIONS.md` §4.1 proposed a `Part` layer between `Lesson` and `Item`. Reading
Kira's session engine changed the design, because two things there would have broken a
grouping layer:

1. **`interleaveByType` scatters it.** `src/session/buildQueue.ts` round-robins the session
   across type buckets, so a Part's diagram and cloze land in different buckets with other
   items between them. Interleaving exists for a real reason (Spec §6 — it aids
   discrimination), so the fix is not to weaken it.
2. **Scheduling is per item id and independent.** Two items in a group can sit in different
   Leitner boxes with different `dueAt`, so a learner could meet the cloze weeks after the
   diagram with the bank in an undefined state.

As one composite item a Part has one id, so cohesion, co-due-ness and interleaving are all
free instead of three exceptions. The registry merged on 2026-08-08 is what makes adding the
type cheap: one union member, one entry in each of `items/logic.ts` and `items/renderers.tsx`.

The cost is that PBD reports per Standard Pembelajaran and one id could blur two. That is
paid off in the result rather than the key: every child carries its own `sp_code` and
`gradePart` reports per child, so per-standard mastery survives.

## Depletion: on correct only

A key consumed by a **correct** placement is gone from the other children. A **wrong**
placement returns to the bank.

True depletion is faithful to the paper worksheet and turns one error into two — the cloze
would offer a term it does not want while missing one it does, unanswerable through no fresh
fault. `parts.test.ts` pins this both ways, including that the cloze stays fully answerable
after a wrong diagram placement.

## Sequence scoring credits the LINK, not the slot

`sequence.ts`, dispatched from `parts.ts`'s `gradeChild`. A rotated chain scores 0.8 by links
and 0 by position — that figure from `KAJI_DECISIONS` §5 is asserted in the tests rather than
trusted, since the whole design rests on it.

It does not uniformly favour the learner, and that is the point. Swapping two adjacent steps
breaks three links, so links give 0.4 where position gives 0.67. Links are sensitive to *local*
order: a swap is a real misunderstanding, a rotation is not.

`inPlace`, `longestRun` and `offsetOnly` are computed and never scored. A long unbroken run with
nothing in place means "you know the order, you started in the wrong place" — a different lesson
from a swapped pair, and one the fraction alone cannot express.

One unit consequence: a sequence child reports `placed`/`of` in links, so a 6-step sequence is
`of: 5` against a 6-label diagram's `of: 6`. `gradePart` totals are therefore *scoreable units*
and a sequence child is slightly under-weighted. Documented rather than fudged.

## Still to come

- **The renderer.** Kaji-specific UI, and not usefully written before Kaji's design exists.
  Two findings from §5 apply to it: a filled slot must be tappable to clear, and labels need
  auto-fit sizing because 小肠 is two full-width glyphs against fifteen half-width ones for
  "Small intestine".
