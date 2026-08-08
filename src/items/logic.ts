import type { Item, ItemType, LocalizedText } from '../content/types'
import type { Response } from '../grading/graders'
import {
  gradeChoice,
  gradeFadedStep,
  gradeJournal,
  gradeNumeric,
  gradeStatement,
  gradeTAccount,
} from '../grading/graders'

/**
 * The item-type registry — the pure half.
 *
 * Kira's spine has always been "content is DATA, not code" (Build Spec §3),
 * and the backend takes that seriously enough that SQL has never known what an
 * item is. But item TYPES were still code, spread across four hard-coded
 * switches: grade(), the renderer dispatch, the content guard, and the exam
 * blueprint's MCQ filter. Adding a type meant finding all four.
 *
 * This collects everything that is true of a type and does not touch the DOM.
 * Renderers live in `renderers.tsx` so that the grading layer stays free of
 * React — `grade()` is imported by the scheduler, the session queue and the
 * sync layer, none of which should pull in a component tree.
 *
 * Nothing about this file is accounting-specific. A second subject supplies
 * its own map and its own union member; neither has to know about the other.
 */
export interface ItemTypeLogic<T extends Item = Item> {
  /** Shown on the question badge. */
  label: LocalizedText

  /** (item, response) -> correct. Total: a wrong-shaped response is wrong. */
  grade: (item: T, response: Response) => boolean

  /**
   * Content-guard checks beyond the universal ones (ids, prompt, explanation).
   * Returns human-readable problems; empty means clean.
   */
  validate?: (item: T) => string[]

  /**
   * Single-answer multiple choice, so it can appear on a Kertas 1 style paper.
   * `exam/paper.ts` used to name the two eligible types directly; a paper
   * should ask the type whether it fits, not carry a list that goes stale.
   */
  singleChoice?: boolean
}

/**
 * `as ItemTypeLogic` on each entry, rather than a generic map type, is
 * deliberate: it lets each entry be written against its OWN narrowed item
 * (gradeTAccount takes a TAccountItem) while the lookup stays keyed by the
 * union. The narrowing is real — grade() below re-asserts nothing.
 */
export const ITEM_LOGIC: Record<ItemType, ItemTypeLogic> = {
  classify: {
    label: { en: 'Classify', ms: 'Kelaskan' },
    grade: gradeChoice,
    singleChoice: true,
    validate: (item) =>
      item.type === 'classify' && !item.data.options?.includes(item.answer)
        ? [`answer "${item.answer}" not in options`]
        : [],
  } as ItemTypeLogic,

  debit_credit: {
    label: { en: 'Debit or Credit', ms: 'Debit atau Kredit' },
    grade: gradeChoice,
    singleChoice: true,
    validate: (item) =>
      item.type === 'debit_credit' && !item.data.options?.includes(item.answer)
        ? [`answer "${item.answer}" not in options`]
        : [],
  } as ItemTypeLogic,

  numeric: {
    label: { en: 'Solve', ms: 'Selesaikan' },
    grade: gradeNumeric,
  } as ItemTypeLogic,

  journal_entry: {
    label: { en: 'Journal entry', ms: 'Catatan jurnal' },
    grade: gradeJournal,
  } as ItemTypeLogic,

  spot_error: {
    label: { en: 'Spot the error', ms: 'Kesan kesilapan' },
    grade: gradeJournal,
  } as ItemTypeLogic,

  t_account: {
    label: { en: 'T-account', ms: 'Akaun T' },
    grade: gradeTAccount,
  } as ItemTypeLogic,

  statement_build: {
    label: { en: 'Build the statement', ms: 'Bina penyata' },
    grade: gradeStatement,
  } as ItemTypeLogic,

  faded_step: {
    label: { en: 'Fill the step', ms: 'Isi langkah' },
    grade: gradeFadedStep,
  } as ItemTypeLogic,
}

export function logicFor(type: ItemType): ItemTypeLogic {
  return ITEM_LOGIC[type]
}
