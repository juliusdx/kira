import { describe, it, expect } from 'vitest'
import { grade, isBalanced, sectionTotals, tAccountBalance } from './grade'
import type {
  ChoiceItem,
  JournalEntryItem,
  NumericItem,
  SpotErrorItem,
  StatementBuildItem,
  TAccountItem,
} from '../content/types'

const choice: ChoiceItem = {
  id: 'c', type: 'classify', difficulty: 1, skill_tags: [],
  prompt: { en: '', ms: '' }, explanation: { en: '', ms: '' },
  data: { options: ['Asset', 'Liability', 'Equity'] }, answer: 'Liability',
}

const numeric: NumericItem = {
  id: 'n', type: 'numeric', difficulty: 1, skill_tags: [],
  prompt: { en: '', ms: '' }, explanation: { en: '', ms: '' },
  data: { unit: 'RM' }, answer: 30000,
}

const je: JournalEntryItem = {
  id: 'j', type: 'journal_entry', difficulty: 2, skill_tags: [],
  prompt: { en: '', ms: '' }, explanation: { en: '', ms: '' },
  data: { accounts: ['Cash', 'Van'] },
  answer: { debit: { account: 'Van', amount: 12000 }, credit: { account: 'Cash', amount: 12000 } },
}

const err: SpotErrorItem = {
  id: 'e', type: 'spot_error', difficulty: 3, skill_tags: [],
  prompt: { en: '', ms: '' }, explanation: { en: '', ms: '' },
  data: { given: { debit: { account: 'Cash', amount: 900 }, credit: { account: 'Wages', amount: 900 } } },
  answer: { debit: { account: 'Wages', amount: 900 }, credit: { account: 'Cash', amount: 900 } },
}

const ta: TAccountItem = {
  id: 't', type: 't_account', difficulty: 2, skill_tags: [],
  prompt: { en: '', ms: '' }, explanation: { en: '', ms: '' },
  data: {
    account: 'Cash',
    entries: [
      { label: { en: '', ms: '' }, amount: 20000, side: 'debit' },
      { label: { en: '', ms: '' }, amount: 12000, side: 'credit' },
      { label: { en: '', ms: '' }, amount: 1500, side: 'debit' },
    ],
  },
  answer: { balance: 9500, side: 'debit' },
}

describe('grade — choice + numeric', () => {
  it('classify: exact option match', () => {
    expect(grade(choice, 'Liability')).toBe(true)
    expect(grade(choice, 'Asset')).toBe(false)
  })
  it('numeric: exact value, wrong type fails', () => {
    expect(grade(numeric, 30000)).toBe(true)
    expect(grade(numeric, 29999)).toBe(false)
    // a non-number response for a numeric item is simply wrong
    expect(grade(numeric, '30000')).toBe(false)
  })
})

describe('grade — journal entry + spot error', () => {
  it('journal: both lines must match account and amount', () => {
    expect(grade(je, { debit: { account: 'Van', amount: 12000 }, credit: { account: 'Cash', amount: 12000 } })).toBe(true)
    // reversed sides are wrong
    expect(grade(je, { debit: { account: 'Cash', amount: 12000 }, credit: { account: 'Van', amount: 12000 } })).toBe(false)
    // wrong amount
    expect(grade(je, { debit: { account: 'Van', amount: 1200 }, credit: { account: 'Cash', amount: 1200 } })).toBe(false)
  })
  it('spot_error: grades the correction', () => {
    expect(grade(err, { debit: { account: 'Wages', amount: 900 }, credit: { account: 'Cash', amount: 900 } })).toBe(true)
    // re-submitting the original wrong entry stays wrong
    expect(grade(err, err.data.given)).toBe(false)
  })
})

describe('isBalanced', () => {
  it('requires equal, positive sides', () => {
    expect(isBalanced({ debit: { account: 'A', amount: 100 }, credit: { account: 'B', amount: 100 } })).toBe(true)
    expect(isBalanced({ debit: { account: 'A', amount: 100 }, credit: { account: 'B', amount: 90 } })).toBe(false)
    expect(isBalanced({ debit: { account: 'A', amount: 0 }, credit: { account: 'B', amount: 0 } })).toBe(false)
  })
})

const sb: StatementBuildItem = {
  id: 's', type: 'statement_build', difficulty: 3, skill_tags: [],
  prompt: { en: '', ms: '' }, explanation: { en: '', ms: '' },
  data: {
    statement: { en: 'Income Statement', ms: '' },
    sections: [
      { key: 'income', label: { en: 'Income', ms: 'Pendapatan' } },
      { key: 'expense', label: { en: 'Expense', ms: 'Belanja' } },
    ],
    lines: [
      { label: { en: 'Service income', ms: '' }, amount: 50000, section: 'income' },
      { label: { en: 'Rent', ms: '' }, amount: 6000, section: 'expense' },
      { label: { en: 'Commission received', ms: '' }, amount: 1000, section: 'income' },
    ],
    totalLabel: { en: 'Net profit', ms: 'Untung bersih' },
  },
  answer: { total: 45000 }, // (50,000 + 1,000) - 6,000
}

describe('grade — statement_build', () => {
  it('needs every line in the right section AND the right figure', () => {
    expect(grade(sb, { sections: { 0: 'income', 1: 'expense', 2: 'income' }, total: 45000 })).toBe(true)
    // a line in the wrong section
    expect(grade(sb, { sections: { 0: 'expense', 1: 'expense', 2: 'income' }, total: 45000 })).toBe(false)
    // right sections, wrong arithmetic
    expect(grade(sb, { sections: { 0: 'income', 1: 'expense', 2: 'income' }, total: 44000 })).toBe(false)
    // unassigned line
    expect(grade(sb, { sections: { 0: 'income', 1: 'expense' }, total: 45000 })).toBe(false)
  })

  it('sectionTotals sums per section and ignores unassigned lines', () => {
    expect(sectionTotals(sb.data.lines, { 0: 'income', 1: 'expense', 2: 'income' })).toEqual({
      income: 51000,
      expense: 6000,
    })
    expect(sectionTotals(sb.data.lines, { 0: 'income' })).toEqual({ income: 50000 })
  })
})

describe('grade — t_account', () => {
  it('needs correct sides AND balance', () => {
    expect(grade(ta, { sides: { 0: 'debit', 1: 'credit', 2: 'debit' }, balance: 9500 })).toBe(true)
    // right balance but a wrong side
    expect(grade(ta, { sides: { 0: 'debit', 1: 'debit', 2: 'debit' }, balance: 33500 })).toBe(false)
    // right sides but wrong balance typed
    expect(grade(ta, { sides: { 0: 'debit', 1: 'credit', 2: 'debit' }, balance: 9000 })).toBe(false)
  })
  it('tAccountBalance computes magnitude and side', () => {
    expect(tAccountBalance(ta.data.entries, { 0: 'debit', 1: 'credit', 2: 'debit' })).toEqual({ balance: 9500, side: 'debit' })
    expect(tAccountBalance([{ amount: 100 }, { amount: 300 }], { 0: 'debit', 1: 'credit' })).toEqual({ balance: 200, side: 'credit' })
  })
})
