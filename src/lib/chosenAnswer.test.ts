import { describe, it, expect } from 'vitest'
import { describeChosen } from './chosenAnswer'
import { getItem } from '../content/loader'
import { grade } from '../grading/grade'
import type { Item } from '../content/types'

// `chosen` arrives as opaque jsonb written by some past version of the client.
// Two things must hold: a real answer is read back faithfully (including WHICH
// part was wrong, which is the whole diagnostic value), and anything
// unexpected degrades to null instead of throwing on a teacher's screen.

const t = (k: 'debit' | 'credit' | 'closingBalance' | 'yourAnswer') => k
const item = (id: string): Item => {
  const it = getItem(id)
  if (!it) throw new Error(`${id} not in the bank`)
  return it
}

describe('describeChosen — reading a real answer back', () => {
  it('a choice item: names the option they picked, in their language', () => {
    const it = item('dc-006') // answer: Credit
    expect(describeChosen(it, 'Debit', 'en', t)).toEqual([
      { label: 'yourAnswer', value: 'Debit', ok: false },
    ])
    // the BM label, not the canonical English value
    expect(describeChosen(it, 'Credit', 'ms', t)).toEqual([
      { label: 'yourAnswer', value: 'Kredit', ok: true },
    ])
  })

  it('a numeric item: keeps the unit it was answered in', () => {
    expect(describeChosen(item('ra-001'), 18, 'en', t)).toEqual([
      { label: 'yourAnswer', value: '18%', ok: false },
    ])
    expect(describeChosen(item('ra-004'), 3, 'ms', t)).toEqual([
      { label: 'yourAnswer', value: '3 kali', ok: true },
    ])
  })

  // The point of the whole feature: on a multi-part item, say WHICH part was
  // wrong. "3× wrong" is a worry; "she put returns inwards on the debit side"
  // is something a parent can act on.
  it('a T-account: marks the individual entry that went to the wrong side', () => {
    const it = item('ta-008') // debit, credit, credit — balance 500
    const lines = describeChosen(
      it,
      { sides: { 0: 'debit', 1: 'debit', 2: 'credit' }, balance: 500 },
      'en',
      t,
    )!
    expect(lines).toHaveLength(4) // 3 entries + the balance
    expect(lines[0].ok).toBe(true)
    // The line reports what SHE put, not the correct side — she posted a
    // receipt from a customer to the debit side of Trade Receivables.
    expect(lines[1]).toEqual({
      label: 'Cash received from customer',
      value: 'debit', // the t() stub returns the key
      ok: false,
    })
    expect(lines[2].ok).toBe(true)
    expect(lines[3]).toEqual({ label: 'closingBalance', value: 'RM 500', ok: true })
  })

  it('a journal entry: shows each side as they built it', () => {
    const it = item('je-001')
    const lines = describeChosen(
      it,
      { debit: { account: 'Cash', amount: 12000 }, credit: { account: 'Van', amount: 12000 } },
      'en',
      t,
    )!
    // je-001 is Dr Van / Cr Cash, so a reversed entry is wrong on both lines
    expect(lines.map((l) => l.ok)).toEqual([false, false])
    expect(lines[0].value).toContain('Cash')
  })

  it('a faded ladder: reports only the steps that were actually asked', () => {
    const it = item('fd-1001') // two blanks: the b/d side, then the b/d amount
    const lines = describeChosen(it, { filled: { 4: 'Credit', 5: 4800 } }, 'en', t)!
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ value: 'Credit', ok: false })
    expect(lines[1]).toMatchObject({ value: 'RM 4,800', ok: true })
  })

  it('a statement build: names the section they filed each line under', () => {
    const it = item('sb-001')
    if (it.type !== 'statement_build') throw new Error('fixture changed')
    const sections = Object.fromEntries(it.data.lines.map((_, i) => [i, it.data.sections[0].key]))
    const lines = describeChosen(it, { sections, total: 1 }, 'en', t)!
    expect(lines).toHaveLength(it.data.lines.length + 1)
    expect(lines.at(-1)).toMatchObject({ value: 'RM 1', ok: false })
  })

  // The canonical answer must read back as entirely correct, or the marking
  // shown to a teacher disagrees with the marking the learner got.
  it('agrees with grade(): a fully correct response shows no red', () => {
    const cases: [string, unknown][] = [
      ['dc-006', 'Credit'],
      ['ra-001', 20],
      ['ta-008', { sides: { 0: 'debit', 1: 'credit', 2: 'credit' }, balance: 500 }],
      ['fd-1001', { filled: { 4: 'Debit', 5: 4800 } }],
    ]
    for (const [id, chosen] of cases) {
      const it = item(id)
      expect(grade(it, chosen as never), `${id} fixture is not actually correct`).toBe(true)
      const lines = describeChosen(it, chosen, 'en', t)!
      expect(
        lines.filter((l) => !l.ok),
        `${id} marked a correct answer as wrong`,
      ).toEqual([])
    }
  })
})

describe('describeChosen — degrading instead of throwing', () => {
  it('returns null when nothing was recorded', () => {
    expect(describeChosen(item('dc-006'), null, 'en', t)).toBeNull()
    expect(describeChosen(item('dc-006'), undefined, 'en', t)).toBeNull()
  })

  it('returns null on a payload of the wrong shape for the item', () => {
    // e.g. the item was re-authored to a different type after the attempt
    expect(describeChosen(item('ta-008'), 'Debit', 'en', t)).toBeNull()
    expect(describeChosen(item('dc-006'), { sides: {} }, 'en', t)).toBeNull()
    expect(describeChosen(item('ra-001'), 'twenty', 'en', t)).toBeNull()
    expect(describeChosen(item('je-001'), { debit: 'Cash' }, 'en', t)).toBeNull()
  })

  it('survives a partial answer without inventing values', () => {
    // she assigned one side and left the rest — the gaps must read as gaps
    const lines = describeChosen(item('ta-008'), { sides: { 0: 'debit' } }, 'en', t)!
    expect(lines[1].value).toBe('—')
    expect(lines[1].ok).toBe(false)
    expect(lines.at(-1)!.value).toBe('—')
  })

  it('never throws on hostile json', () => {
    for (const junk of [[], 0, '', true, { filled: 'no' }, { sides: null }]) {
      for (const id of ['dc-006', 'ra-001', 'ta-008', 'fd-1001', 'je-001', 'sb-001']) {
        expect(() => describeChosen(item(id), junk, 'ms', t)).not.toThrow()
      }
    }
  })
})
