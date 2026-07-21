import { describe, it, expect } from 'vitest'
import { ALL_ENTRIES, CONTENT } from './loader'
import { grade, tAccountBalance, sectionTotals, type Response } from '../grading/grade'
import type { Item, LocalizedText } from './types'

// Guards the whole authored bank (all stages). Any future content port —
// Stage 5, a new topic, a hand-edited answer — has to pass these.

const items: Item[] = ALL_ENTRIES.map((e) => e.item)

function bilingual(text: LocalizedText | undefined): boolean {
  return !!text && !!text.en?.trim() && !!text.ms?.trim()
}

/** The canonical correct response for an item, built from its own answer. */
function correctResponse(item: Item): Response {
  switch (item.type) {
    case 'classify':
    case 'debit_credit':
      return item.answer
    case 'numeric':
      return item.answer
    case 'journal_entry':
    case 'spot_error':
      return item.answer
    case 't_account':
      return {
        sides: Object.fromEntries(item.data.entries.map((e, i) => [i, e.side])),
        balance: item.answer.balance,
      }
    case 'statement_build':
      return {
        sections: Object.fromEntries(item.data.lines.map((l, i) => [i, l.section])),
        total: item.answer.total,
      }
  }
}

describe('content bank — structure', () => {
  it('has content and unique item ids', () => {
    expect(items.length).toBeGreaterThan(50)
    const ids = items.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every topic and lesson is bilingual and ordered', () => {
    for (const topic of CONTENT.topics) {
      expect(bilingual(topic.title), `topic ${topic.id} title`).toBe(true)
      expect(topic.lessons.length).toBeGreaterThan(0)
      for (const lesson of topic.lessons) {
        expect(bilingual(lesson.title), `lesson ${lesson.id} title`).toBe(true)
        if (lesson.worked_example)
          expect(
            bilingual(lesson.worked_example.prompt),
            `lesson ${lesson.id} worked example`,
          ).toBe(true)
      }
    }
  })

  it('every item has a bilingual prompt and explanation', () => {
    for (const item of items) {
      expect(bilingual(item.prompt), `${item.id} prompt`).toBe(true)
      expect(bilingual(item.explanation), `${item.id} explanation`).toBe(true)
      expect(item.difficulty).toBeGreaterThanOrEqual(1)
      expect(item.difficulty).toBeLessThanOrEqual(5)
    }
  })
})

describe('content bank — per-type integrity', () => {
  it('choice items: answer is one of the options, BM labels align', () => {
    for (const item of items) {
      if (item.type !== 'classify' && item.type !== 'debit_credit') continue
      expect(item.data.options, `${item.id} options`).toContain(item.answer)
      if (item.data.options_ms)
        expect(item.data.options_ms.length, `${item.id} options_ms length`).toBe(
          item.data.options.length,
        )
    }
  })

  it('numeric items: answers are finite numbers', () => {
    for (const item of items) {
      if (item.type !== 'numeric') continue
      expect(Number.isFinite(item.answer), `${item.id} answer`).toBe(true)
    }
  })

  it('double entries balance (Dr = Cr) with positive amounts', () => {
    for (const item of items) {
      if (item.type !== 'journal_entry' && item.type !== 'spot_error') continue
      const { debit, credit } = item.answer
      expect(debit.amount, `${item.id} debit amount`).toBeGreaterThan(0)
      expect(debit.amount, `${item.id} Dr must equal Cr`).toBe(credit.amount)
      expect(debit.account).not.toBe(credit.account)
    }
  })

  it('journal_entry answer accounts exist in the offered account pool', () => {
    for (const item of items) {
      if (item.type !== 'journal_entry') continue
      expect(item.data.accounts, `${item.id} debit account`).toContain(
        item.answer.debit.account,
      )
      expect(item.data.accounts, `${item.id} credit account`).toContain(
        item.answer.credit.account,
      )
      if (item.data.accounts_ms)
        expect(item.data.accounts_ms.length).toBe(item.data.accounts.length)
    }
  })

  it('spot_error: the correction actually differs from the wrong entry', () => {
    for (const item of items) {
      if (item.type !== 'spot_error') continue
      expect(JSON.stringify(item.answer)).not.toBe(JSON.stringify(item.data.given))
    }
  })

  it('t_account: stated balance and side match the entries', () => {
    for (const item of items) {
      if (item.type !== 't_account') continue
      const sides = Object.fromEntries(item.data.entries.map((e, i) => [i, e.side]))
      const computed = tAccountBalance(item.data.entries, sides)
      expect(computed.balance, `${item.id} balance`).toBe(item.answer.balance)
      expect(computed.side, `${item.id} side`).toBe(item.answer.side)
      for (const e of item.data.entries) {
        expect(bilingual(e.label), `${item.id} entry label`).toBe(true)
        expect(e.amount).toBeGreaterThan(0)
      }
    }
  })

  it('statement_build: lines map to real sections and the figure is consistent', () => {
    for (const item of items) {
      if (item.type !== 'statement_build') continue
      const keys = item.data.sections.map((s) => s.key)
      expect(new Set(keys).size, `${item.id} duplicate section keys`).toBe(keys.length)
      expect(bilingual(item.data.statement), `${item.id} statement name`).toBe(true)
      expect(bilingual(item.data.totalLabel), `${item.id} total label`).toBe(true)

      for (const line of item.data.lines) {
        expect(keys, `${item.id} line section "${line.section}"`).toContain(line.section)
        expect(bilingual(line.label), `${item.id} line label`).toBe(true)
        expect(line.amount).toBeGreaterThan(0)
      }
      // every section is actually used, so no line-up is trivially empty
      for (const key of keys)
        expect(
          item.data.lines.some((l) => l.section === key),
          `${item.id} unused section ${key}`,
        ).toBe(true)

      // the figure = first section total − second section total
      // (net profit = income − expense; capital = assets − liabilities)
      const sides = Object.fromEntries(item.data.lines.map((l, i) => [i, l.section]))
      const totals = sectionTotals(item.data.lines, sides)
      expect(keys.length, `${item.id} expects 2 sections`).toBe(2)
      expect(totals[keys[0]] - totals[keys[1]], `${item.id} total`).toBe(
        item.answer.total,
      )
    }
  })
})

describe('content bank — grading round-trip', () => {
  it('grade() accepts the canonical answer for EVERY item', () => {
    const failures = items
      .filter((item) => !grade(item, correctResponse(item)))
      .map((i) => `${i.id} (${i.type})`)
    expect(failures).toEqual([])
  })
})
