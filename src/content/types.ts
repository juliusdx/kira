// Content model — the spine. Content is DATA, not code (Build Spec §3).
// Every item conforms to one of the interaction types below. The schema is
// syllabus-agnostic so it can extend beyond SPM later.

export type Locale = 'en' | 'ms'

export interface LocalizedText {
  en: string
  ms: string
}

export type ItemType =
  | 'classify' // tap Asset / Liability / Equity ...
  | 'debit_credit' // tap the correct side
  | 'numeric' // type a number (solve the equation)
  | 'journal_entry' // pick accounts + amounts; must balance
  | 't_account' // assign entries to Dr/Cr; compute closing balance
  | 'spot_error' // find and correct a wrong entry
  | 'statement_build' // sort lines into statement sections; compute the figure
  | 'faded_step' // fill the blanked step(s) of a partially-worked solution

export interface BaseItem {
  id: string
  type: ItemType
  difficulty: number // 1..5
  skill_tags: string[]
  prompt: LocalizedText
  explanation: LocalizedText
}

/** A single side of a double entry. `account` is the English canonical name. */
export interface JournalLine {
  account: string
  amount: number
}

/** classify + debit_credit share a single-choice shape. */
export interface ChoiceItem extends BaseItem {
  type: 'classify' | 'debit_credit'
  data: {
    options: string[] // English canonical values (also the answer space)
    options_ms?: string[] // parallel BM labels for display
  }
  answer: string // one of options (English canonical)
}

export interface NumericItem extends BaseItem {
  type: 'numeric'
  data: {
    unit?: string // defaults to the bundle currency
    unit_ms?: string // parallel BM label ('times' → 'kali'); '%' needs none
    /**
     * Where the unit sits. A currency leads (`RM 30`); a ratio trails
     * (`30%`, `8 times`). Authored per item because it is a property of the
     * unit, not of the renderer.
     */
    unitAfter?: boolean
  }
  answer: number
}

export interface JournalEntryItem extends BaseItem {
  type: 'journal_entry'
  data: {
    accounts: string[] // English canonical account names to choose from
    accounts_ms?: string[] // parallel BM labels
  }
  answer: { debit: JournalLine; credit: JournalLine }
}

export interface SpotErrorItem extends BaseItem {
  type: 'spot_error'
  data: {
    given: { debit: JournalLine; credit: JournalLine } // the wrong entry shown
    accounts?: string[] // optional pool; defaults to accounts in given/answer
    accounts_ms?: string[]
  }
  answer: { debit: JournalLine; credit: JournalLine } // the correction
}

export interface TAccountEntry {
  label: LocalizedText
  amount: number
  side: 'debit' | 'credit' // the correct side (hidden from the learner)
}

export interface TAccountItem extends BaseItem {
  type: 't_account'
  data: {
    account: string
    account_ms?: string
    entries: TAccountEntry[]
  }
  answer: { balance: number; side: 'debit' | 'credit' }
}

/** One column/section of a financial statement (e.g. Income vs Expense). */
export interface StatementSection {
  key: string
  label: LocalizedText
}

export interface StatementLine {
  label: LocalizedText
  amount: number
  section: string // the correct section key (hidden from the learner)
}

/**
 * Statement build (Spec §3, type 7): sort trial-balance lines into the
 * sections of a statement, then compute the resulting figure.
 */
export interface StatementBuildItem extends BaseItem {
  type: 'statement_build'
  data: {
    statement: LocalizedText // e.g. "Income Statement"
    sections: StatementSection[]
    lines: StatementLine[]
    totalLabel: LocalizedText // e.g. "Net profit"
  }
  answer: { total: number }
}

/**
 * One line of a worked solution. A step is either already worked for the
 * learner or `blank`, in which case they must supply its `value`.
 */
export interface FadedChoiceStep {
  kind: 'choice'
  label: LocalizedText // what this step decides, e.g. "Account to debit"
  value: string // English canonical answer
  value_ms: string // BM label for the same value
  blank?: boolean
}

export interface FadedNumberStep {
  kind: 'number'
  label: LocalizedText
  value: number
  unit?: string // defaults to the bundle currency
  unit_ms?: string // see NumericItem.data.unit_ms
  unitAfter?: boolean // see NumericItem.data.unitAfter
  blank?: boolean
}

export type FadedStep = FadedChoiceStep | FadedNumberStep

/**
 * Faded step (Spec §3, type 6) — the backward-fading mechanic. A procedure is
 * shown as an ordered worked solution with some steps blanked out. Fading is
 * expressed in the CONTENT, not in code: author the same procedure several
 * times, blanking one more step each rung, last-first (Spec §2, "fully worked
 * → last step blank → last two blank → cold solve").
 *
 * There is deliberately no separate `answer` — a blank step's own `value` is
 * the answer key, so a ladder can never drift out of sync with its solution.
 */
export interface FadedStepItem extends BaseItem {
  type: 'faded_step'
  data: {
    scenario?: LocalizedText // context shown above the workings
    steps: FadedStep[]
    /** Extra wrong options folded into the pool offered for blank choices. */
    distractors?: { value: string; value_ms: string }[]
  }
}

export type Item =
  | ChoiceItem
  | NumericItem
  | JournalEntryItem
  | SpotErrorItem
  | TAccountItem
  | StatementBuildItem
  | FadedStepItem

export interface WorkedExample {
  prompt: LocalizedText
}

export interface Lesson {
  id: string
  order: number
  title: LocalizedText
  worked_example?: WorkedExample
  items: Item[]
}

export interface Topic {
  id: string
  order: number
  title: LocalizedText
  lessons: Lesson[]
}

export interface ContentMeta {
  version: number
  currency: string
  locales: Locale[]
  note?: string
}

export interface ContentBundle {
  meta: ContentMeta
  topics: Topic[]
}

/** Flat view used by the session engine + progress. */
export interface ItemIndexEntry {
  item: Item
  topicId: string
  lessonId: string
  /** global content order — used to pick "new" items deterministically */
  order: number
}
