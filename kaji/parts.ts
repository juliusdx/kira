// Shared option banks for Kaji — the WA0065 problem.
//
// THIS IS KAJI CODE LIVING TEMPORARILY IN THE KIRA REPO. Nothing in src/
// imports it, so it never enters Kira's bundle; it is here to be typechecked
// and tested against a real suite until the Kaji repo exists. See kaji/README.md.
//
// ---------------------------------------------------------------------------
// THE PROBLEM (KAJI_DECISIONS §4.1)
//
// Worksheet WA0065 carries ONE word bank of 11 terms shared between a
// diagram-labelling part (uses 6) and a cloze passage below it (uses the other
// 5). The sharing IS the pedagogy: the distractors for the diagram are the
// answers to the cloze, so the learner works by elimination across both.
//
// THE DESIGN (decided 2026-08-08)
//
// A Part is a COMPOSITE ITEM TYPE, not a layer between Lesson and Item. Two
// findings in Kira's own session engine forced that:
//
//   1. `interleaveByType` round-robins across type buckets, so a Part's
//      diagram and cloze would land in different buckets separated by whatever
//      else is in the session — destroying the shared-bank pedagogy.
//   2. Scheduling is per item id and independent, so two items in a group can
//      sit in different Leitner boxes. A learner could meet the cloze weeks
//      after the diagram, with the bank in an undefined state.
//
// As one composite item it has one id, so co-due-ness, cohesion and
// interleaving are free rather than three exceptions to write. The cost is that
// PBD reports per Standard Pembelajaran and one id could blur two — which is
// why every child carries its own `sp_code` and grading reports per child. The
// granularity lives in the result, not in the scheduling key.
//
// DEPLETION: ON CORRECT ONLY (decided 2026-08-08)
//
// A key consumed by a CORRECT placement is gone from the other children. A
// wrong placement returns to the bank. True depletion is faithful to paper and
// turns one error into two — the cloze would then offer a wrong term and be
// missing a right one, unanswerable through no fresh fault of the learner's.
// For a nine-year-old that is punishment, not assessment.

/** All three languages are display labels. No language is the answer space. */
export interface LocalizedText {
  zh: string
  ms: string
  en: string
}

/**
 * A bank entry. `key` is OPAQUE and meaningless — never a translation.
 * KAJI_DECISIONS §4: Kira can use "Trade Payables" as an answer because account
 * names are stable English terms; 孢子 has no privileged rendering.
 */
export interface BankOption {
  key: string
  label: LocalizedText
}

export interface PartSlot {
  id: string
  /** The bank key that belongs here. */
  answer: string
}

export interface PartChild {
  id: string
  /** Which interaction this child is. Drives the renderer, not the bank logic. */
  kind: 'label_diagram' | 'cloze' | 'matching' | 'classify' | 'sequence'
  /** Its own Standard Pembelajaran, so a two-SP Part still reports per standard. */
  sp_code: string
  slots: PartSlot[]
}

export interface PartData {
  bank: BankOption[]
  children: PartChild[]
}

/** slotId -> chosen bank key. Absent slot = not yet answered. */
export type PartResponse = Record<string, string>

// --- the bank state machine -------------------------------------------------

function slotIndex(data: PartData): Map<string, { childId: string; answer: string }> {
  const out = new Map<string, { childId: string; answer: string }>()
  for (const child of data.children)
    for (const slot of child.slots)
      out.set(slot.id, { childId: child.id, answer: slot.answer })
  return out
}

/** Was this slot filled correctly? */
export function slotIsCorrect(data: PartData, response: PartResponse, slotId: string): boolean {
  const slot = slotIndex(data).get(slotId)
  if (!slot) return false
  const chosen = response[slotId]
  return chosen !== undefined && chosen === slot.answer
}

/**
 * Keys locked by a CORRECT placement somewhere in the Part.
 *
 * This is the whole depletion rule in one function. Note it does NOT include
 * keys placed incorrectly — those are handed back, which is the decision above.
 */
export function consumedKeys(data: PartData, response: PartResponse): Set<string> {
  const out = new Set<string>()
  const index = slotIndex(data)
  for (const [slotId, chosen] of Object.entries(response)) {
    const slot = index.get(slotId)
    if (slot && chosen === slot.answer) out.add(chosen)
  }
  return out
}

/**
 * Which bank options this child may currently offer.
 *
 * Two exclusions, and they are different in kind:
 *   - keys correctly used by ANOTHER child, per the depletion rule;
 *   - keys this child has already placed in one of its own slots, right or
 *     wrong, because you cannot label two organs 小肠 in the same diagram.
 */
export function availableFor(
  data: PartData,
  response: PartResponse,
  childId: string,
): BankOption[] {
  const child = data.children.find((c) => c.id === childId)
  if (!child) return []

  const index = slotIndex(data)
  const lockedElsewhere = new Set<string>()
  for (const [slotId, chosen] of Object.entries(response)) {
    const slot = index.get(slotId)
    if (!slot || slot.childId === childId) continue
    if (chosen === slot.answer) lockedElsewhere.add(chosen)
  }

  const usedHere = new Set(
    child.slots.map((s) => response[s.id]).filter((v): v is string => v !== undefined),
  )

  return data.bank.filter((o) => !lockedElsewhere.has(o.key) && !usedHere.has(o.key))
}

// --- grading ----------------------------------------------------------------

export interface ChildGrade {
  childId: string
  sp_code: string
  /** 0..1 — the diagnosis, and what the scheduler demotes on. */
  score: number
  /** The headline a nine-year-old can read. */
  placed: number
  of: number
}

export interface PartGrade {
  score: number
  placed: number
  of: number
  /** Per child, so a Part spanning two SPs still reports per standard. */
  byChild: ChildGrade[]
}

/**
 * Score a child by slot agreement.
 *
 * A `sequence` child does NOT belong here: KAJI_DECISIONS §5 scores sequencing
 * on ADJACENT-PAIR agreement, because absolute-position matching punishes a
 * learner who has the whole chain right but displaced one step — measured at
 * 0.8 by pairs against 0 by position. That grader is the other open item; when
 * it lands, dispatch to it from here on `child.kind === 'sequence'` rather than
 * widening this function.
 */
function gradeChild(data: PartData, response: PartResponse, child: PartChild): ChildGrade {
  const of = child.slots.length
  const placed = child.slots.filter((s) => slotIsCorrect(data, response, s.id)).length
  return {
    childId: child.id,
    sp_code: child.sp_code,
    score: of === 0 ? 0 : placed / of,
    placed,
    of,
  }
}

/**
 * Partial credit across the whole Part.
 *
 * All-or-nothing is right for a Kira journal entry — a double entry that does
 * not balance is simply wrong. It tells a Year 3 pupil nothing about a
 * six-organ diagram, and PBD reports per standard, so the breakdown is the
 * point rather than a nicety.
 *
 * The overall score is slots correct over slots total, NOT the mean of the
 * children's scores: a 6-slot diagram and a 5-slot cloze should not each be
 * worth half, or one careless slot in the smaller child outweighs one in the
 * larger.
 */
export function gradePart(data: PartData, response: PartResponse): PartGrade {
  const byChild = data.children.map((c) => gradeChild(data, response, c))
  const placed = byChild.reduce((s, c) => s + c.placed, 0)
  const of = byChild.reduce((s, c) => s + c.of, 0)
  return { score: of === 0 ? 0 : placed / of, placed, of, byChild }
}

// --- authoring guard --------------------------------------------------------

/**
 * Content-guard checks, in the spirit of Kira's `content.test.ts`.
 *
 * The last one is the interesting one and it is the reason a Part exists at
 * all: if the bank is bigger than the union of every answer, the surplus terms
 * are pure noise; if it is exactly the union, elimination across children
 * works, which IS the pedagogy WA0065 was built on. Authoring a bank with
 * stray extras silently weakens the item, and nothing else would catch it.
 */
export function validatePart(data: PartData): string[] {
  const errors: string[] = []
  const keys = new Set(data.bank.map((o) => o.key))

  if (data.bank.length !== keys.size) errors.push('bank has duplicate keys')
  if (data.children.length < 2)
    errors.push('a part with one child is just an item — use the item type directly')

  const seenSlots = new Set<string>()
  const answers = new Set<string>()

  for (const child of data.children) {
    if (!child.slots.length) errors.push(`${child.id}: no slots`)
    if (!child.sp_code) errors.push(`${child.id}: missing sp_code — PBD reports per standard`)
    for (const slot of child.slots) {
      if (seenSlots.has(slot.id)) errors.push(`slot id "${slot.id}" is used twice`)
      seenSlots.add(slot.id)
      if (!keys.has(slot.answer))
        errors.push(`${child.id}/${slot.id}: answer "${slot.answer}" is not in the bank`)
      answers.add(slot.answer)
    }
  }

  for (const o of data.bank)
    if (!o.label?.zh?.trim() || !o.label?.ms?.trim() || !o.label?.en?.trim())
      errors.push(`bank option "${o.key}" is not trilingual`)

  const surplus = [...keys].filter((k) => !answers.has(k))
  if (surplus.length)
    errors.push(
      `bank has ${surplus.length} option(s) no child answers (${surplus.join(', ')}) — ` +
        'a shared bank should be exactly the union of the answers, or the extras are ' +
        'noise and the elimination pedagogy is lost',
    )

  return errors
}
