import type { FadedStep, FadedStepItem, Item, JournalLine } from '../content/types'

// Pure grading. Each interaction produces a `Response`; grade() maps
// (item, response) -> correct. No UI, no I/O — fully unit-testable.

export interface JournalResponse {
  debit: JournalLine
  credit: JournalLine
}

export interface TAccountResponse {
  /** entry index -> side the learner assigned it to */
  sides: Record<number, 'debit' | 'credit'>
  balance: number
}

export interface StatementResponse {
  /** line index -> section key the learner assigned it to */
  sections: Record<number, string>
  total: number
}

export interface FadedStepResponse {
  /** step index -> the value the learner supplied (blank steps only) */
  filled: Record<number, string | number>
}

export type Response =
  | string // classify | debit_credit  (chosen canonical option)
  | number // numeric
  | JournalResponse // journal_entry | spot_error
  | TAccountResponse // t_account
  | StatementResponse // statement_build
  | FadedStepResponse // faded_step

function lineEq(a: JournalLine, b: JournalLine): boolean {
  return a.account === b.account && a.amount === b.amount
}

function entryEq(a: JournalResponse, b: JournalResponse): boolean {
  return lineEq(a.debit, b.debit) && lineEq(a.credit, b.credit)
}

export function isBalanced(r: JournalResponse): boolean {
  return (
    r.debit.amount > 0 && r.credit.amount > 0 && r.debit.amount === r.credit.amount
  )
}

/** Closing balance implied by a set of Dr/Cr side assignments. */
export function tAccountBalance(
  entries: { amount: number }[],
  sides: Record<number, 'debit' | 'credit'>,
): { balance: number; side: 'debit' | 'credit' } {
  let dr = 0
  let cr = 0
  entries.forEach((e, i) => {
    if (sides[i] === 'credit') cr += e.amount
    else dr += e.amount // default/unassigned treated as debit for the running total
  })
  const diff = dr - cr
  return { balance: Math.abs(diff), side: diff >= 0 ? 'debit' : 'credit' }
}

export function grade(item: Item, response: Response): boolean {
  switch (item.type) {
    case 'classify':
    case 'debit_credit':
      return response === item.answer

    case 'numeric':
      return typeof response === 'number' && response === item.answer

    case 'journal_entry':
      return (
        isJournalResponse(response) && entryEq(response, item.answer as JournalResponse)
      )

    case 'spot_error':
      return (
        isJournalResponse(response) && entryEq(response, item.answer as JournalResponse)
      )

    case 't_account': {
      if (!isTAccountResponse(response)) return false
      const { entries } = item.data
      // every entry assigned to its correct side ...
      const sidesOk = entries.every((e, i) => response.sides[i] === e.side)
      // ... and the closing balance matches
      return sidesOk && response.balance === item.answer.balance
    }

    case 'statement_build': {
      if (!isStatementResponse(response)) return false
      const { lines } = item.data
      // every line in its correct section ...
      const sectionsOk = lines.every((l, i) => response.sections[i] === l.section)
      // ... and the computed figure matches
      return sectionsOk && response.total === item.answer.total
    }

    case 'faded_step': {
      if (!isFadedStepResponse(response)) return false
      const blanks = blankSteps(item)
      // An item with nothing faded would grade as trivially correct.
      if (!blanks.length) return false
      // Strict equality also separates the kinds: a number step is never
      // satisfied by the string "3000".
      return blanks.every(({ step, index }) => response.filled[index] === step.value)
    }
  }
}

/** The faded (blanked) steps of an item, with their positions preserved. */
export function blankSteps(
  item: FadedStepItem,
): { step: FadedStep; index: number }[] {
  return item.data.steps
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.blank)
}

/**
 * Options offered for a blank choice step: every choice value used in the
 * item, plus any authored distractors. Deriving the pool from the steps keeps
 * labels aligned by construction — no parallel `options_ms` array to drift.
 */
export function fadedChoicePool(
  item: FadedStepItem,
): { value: string; value_ms: string }[] {
  const pool: { value: string; value_ms: string }[] = []
  const seen = new Set<string>()
  const add = (o: { value: string; value_ms: string }) => {
    if (seen.has(o.value)) return
    seen.add(o.value)
    pool.push(o)
  }
  for (const step of item.data.steps)
    if (step.kind === 'choice') add({ value: step.value, value_ms: step.value_ms })
  for (const d of item.data.distractors ?? []) add(d)
  return pool
}

/** Running total per section — used for the live statement preview. */
export function sectionTotals(
  lines: { amount: number }[],
  sections: Record<number, string>,
): Record<string, number> {
  const totals: Record<string, number> = {}
  lines.forEach((l, i) => {
    const key = sections[i]
    if (key) totals[key] = (totals[key] ?? 0) + l.amount
  })
  return totals
}

function isJournalResponse(r: Response): r is JournalResponse {
  return typeof r === 'object' && r !== null && 'debit' in r && 'credit' in r
}
function isTAccountResponse(r: Response): r is TAccountResponse {
  return typeof r === 'object' && r !== null && 'sides' in r && 'balance' in r
}
function isStatementResponse(r: Response): r is StatementResponse {
  return typeof r === 'object' && r !== null && 'sections' in r && 'total' in r
}
function isFadedStepResponse(r: Response): r is FadedStepResponse {
  return typeof r === 'object' && r !== null && 'filled' in r
}
