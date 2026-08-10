// Scoring an ordering question.
//
// KAJI CODE, temporarily in the Kira repo. Nothing in src/ imports it. See kaji/README.md.
//
// ---------------------------------------------------------------------------
// WHY NOT ABSOLUTE POSITION (KAJI_DECISIONS §5)
//
// Position matching asks "is step 3 in slot 3". A learner who has the entire
// chain right but starts one place late gets every later step marked wrong, so
// the score reads 0 for an answer that demonstrates the whole procedure.
//
// MEASURED, and re-verified before writing this:
//   correct   [s1 s2 s3 s4 s5 s6]
//   response  [s6 s1 s2 s3 s4 s5]
//   adjacent pairs 4/5 = 0.8      absolute positions 0/6 = 0
//
// It is demoralising and it is diagnostically FALSE — 0 says "knows nothing
// about the order", when the learner knows all of it bar the starting point.
// So the unit of credit is the LINK between two steps, not the slot.
//
// WHAT THE CHILD SEES
//
// §5: show the absolute count, not the fraction — "0.8" and "adjacent pairs"
// are not things a nine-year-old parses. `placed`/`of` is the headline and
// counts LINKS; `score` is the same information normalised for the scheduler,
// which needs one 0..1 number comparable across every item type.
//
// `inPlace` and `longestRun` are diagnosis only and never scored. Together they
// name a specific, common, teachable mistake that a pair score alone cannot:
// a long run with zero items in place means "you know the order, you started in
// the wrong place", which is a different conversation from "you have two steps
// swapped".

export interface SequenceGrade {
  /** 0..1 adjacent-pair agreement. The scheduler's number. */
  score: number
  /** Correct LINKS between adjacent steps — the headline count. */
  placed: number
  /** Total links, i.e. steps − 1. */
  of: number
  /** Steps sitting in their correct absolute slot. Diagnosis only, never scored. */
  inPlace: number
  /** Longest unbroken correctly-ordered chain, counted in STEPS. Diagnosis only. */
  longestRun: number
  /** The whole chain intact but started in the wrong place. Diagnosis only. */
  offsetOnly: boolean
}

const EMPTY: SequenceGrade = {
  score: 0,
  placed: 0,
  of: 0,
  inPlace: 0,
  longestRun: 0,
  offsetOnly: false,
}

/**
 * Score a response against the correct order.
 *
 * `response` is parallel to `correct` — one entry per slot, `null` where the
 * learner has not placed anything yet. A link is only credited when BOTH of its
 * ends are filled, so a half-finished answer is never punished for the gap
 * itself; it simply has fewer links available to earn.
 */
export function gradeSequence(
  correct: readonly string[],
  response: readonly (string | null | undefined)[],
): SequenceGrade {
  const n = correct.length
  // A single step has no links, so there is nothing to order and nothing to
  // score. validateSequence rejects authoring one; grading returns zeros rather
  // than dividing by zero on a screen someone is looking at.
  if (n < 2) return { ...EMPTY }

  const rank = new Map<string, number>()
  correct.forEach((key, i) => {
    // First occurrence wins. A duplicated step is an authoring fault that
    // validateSequence catches; grading must not throw over it.
    if (!rank.has(key)) rank.set(key, i)
  })

  const of = n - 1
  let placed = 0
  for (let i = 0; i < n - 1; i++) {
    const a = response[i]
    const b = response[i + 1]
    if (a == null || b == null) continue
    const ra = rank.get(a)
    const rb = rank.get(b)
    if (ra === undefined || rb === undefined) continue // a key not in this sequence
    if (rb === ra + 1) placed++
  }

  let inPlace = 0
  for (let i = 0; i < n; i++) if (response[i] != null && response[i] === correct[i]) inPlace++

  // Longest run of consecutively-correct links, expressed in steps: a run of
  // k links is k+1 steps. Zero links correct means the longest chain is a lone
  // step, or nothing at all if the learner has placed nothing.
  let longestLinks = 0
  let run = 0
  for (let i = 0; i < n - 1; i++) {
    const a = response[i]
    const b = response[i + 1]
    const ra = a == null ? undefined : rank.get(a)
    const rb = b == null ? undefined : rank.get(b)
    if (ra !== undefined && rb !== undefined && rb === ra + 1) {
      run++
      if (run > longestLinks) longestLinks = run
    } else {
      run = 0
    }
  }
  const anyPlaced = response.some((r) => r != null)
  const longestRun = longestLinks > 0 ? longestLinks + 1 : anyPlaced ? 1 : 0

  return {
    score: placed / of,
    placed,
    of,
    inPlace,
    longestRun,
    // Every step present and the chain unbroken except at one seam, yet nothing
    // sits in its own slot: the order is known, the entry point is not.
    offsetOnly: inPlace === 0 && longestRun === n - 1 && response.every((r) => r != null),
  }
}

/**
 * Absolute-position scoring, kept ONLY so tests can demonstrate what was
 * rejected and why. Never call it to grade anything.
 */
export function positionScore(
  correct: readonly string[],
  response: readonly (string | null | undefined)[],
): number {
  if (!correct.length) return 0
  let hit = 0
  for (let i = 0; i < correct.length; i++) if (response[i] === correct[i]) hit++
  return hit / correct.length
}

export function validateSequence(correct: readonly string[]): string[] {
  const errors: string[] = []
  if (correct.length < 2)
    errors.push('a sequence needs at least 2 steps — one step has no order to get wrong')
  if (new Set(correct).size !== correct.length)
    errors.push('a sequence has a duplicated step, so its correct order is ambiguous')
  return errors
}
