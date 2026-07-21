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
  data: { unit?: string }
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

export type Item =
  | ChoiceItem
  | NumericItem
  | JournalEntryItem
  | SpotErrorItem
  | TAccountItem

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
