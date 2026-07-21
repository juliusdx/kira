import type { Item, JournalLine } from '../content/types'

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

export type Response =
  | string // classify | debit_credit  (chosen canonical option)
  | number // numeric
  | JournalResponse // journal_entry | spot_error
  | TAccountResponse // t_account

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
  }
}

function isJournalResponse(r: Response): r is JournalResponse {
  return typeof r === 'object' && r !== null && 'debit' in r && 'credit' in r
}
function isTAccountResponse(r: Response): r is TAccountResponse {
  return typeof r === 'object' && r !== null && 'sides' in r && 'balance' in r
}
