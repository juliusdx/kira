import { describe, expect, it } from 'vitest'
import { ITEM_LOGIC } from './logic'
import { ITEM_RENDERERS } from './renderers'
import { ALL_ITEMS } from '../content/loader'
import type { ItemType } from '../content/types'

// The registry's whole job is that adding an interaction type is one edit in
// one place. These tests are what make that true: a type with no renderer, or
// a renderer with no logic, fails here rather than at runtime on the one item
// that uses it.
//
// TypeScript's Record<ItemType, …> already forces both maps to be complete,
// so these assertions are belt-and-braces for the case where someone widens a
// map to a plain object or reaches for `as`.

const EXPECTED: ItemType[] = [
  'classify',
  'debit_credit',
  'numeric',
  'journal_entry',
  't_account',
  'spot_error',
  'statement_build',
  'faded_step',
]

describe('item type registry', () => {
  it('covers every declared type in both halves', () => {
    expect(Object.keys(ITEM_LOGIC).sort()).toEqual([...EXPECTED].sort())
    expect(Object.keys(ITEM_RENDERERS).sort()).toEqual([...EXPECTED].sort())
  })

  it('gives every type a grader and a bilingual label', () => {
    for (const [type, spec] of Object.entries(ITEM_LOGIC)) {
      expect(typeof spec.grade, `${type}.grade`).toBe('function')
      expect(spec.label.en, `${type}.label.en`).toBeTruthy()
      expect(spec.label.ms, `${type}.label.ms`).toBeTruthy()
    }
  })

  it('gives every type a renderer', () => {
    for (const [type, render] of Object.entries(ITEM_RENDERERS))
      expect(typeof render, `${type} renderer`).toBe('function')
  })

  it('marks exactly the single-answer types as exam-eligible', () => {
    // The exam blueprint asks the type instead of naming types itself. If a
    // future type is single-answer, flipping this flag is what puts it on the
    // paper — and this test is where that decision gets recorded.
    const single = Object.entries(ITEM_LOGIC)
      .filter(([, s]) => s.singleChoice)
      .map(([t]) => t)
      .sort()
    expect(single).toEqual(['classify', 'debit_credit'])
  })

  it('every authored item resolves to a registered type', () => {
    for (const item of ALL_ITEMS) {
      expect(ITEM_LOGIC[item.type], `logic for ${item.id}`).toBeDefined()
      expect(ITEM_RENDERERS[item.type], `renderer for ${item.id}`).toBeDefined()
    }
  })
})
