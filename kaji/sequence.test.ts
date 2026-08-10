import { describe, it, expect } from 'vitest'
import { gradeSequence, positionScore, validateSequence } from './sequence'

// 消化过程 — ordering the digestive process. The first Kaji build (§5), and the
// largest topic cluster in the source folder at 17 of 77 files.
const DIGESTION = ['mouth', 'oesophagus', 'stomach', 'small-intestine', 'large-intestine', 'anus']

describe('the measurement this design rests on', () => {
  it('scores the rotated chain 0.8 by links and 0 by position', () => {
    // KAJI_DECISIONS §5 states this figure. It is asserted here rather than
    // trusted, because every argument for link-scoring depends on it.
    const rotated = ['anus', 'mouth', 'oesophagus', 'stomach', 'small-intestine', 'large-intestine']
    const g = gradeSequence(DIGESTION, rotated)
    expect(g.score).toBe(0.8)
    expect([g.placed, g.of]).toEqual([4, 5])
    expect(positionScore(DIGESTION, rotated)).toBe(0)
  })

  it('and names WHY it is 0.8 — the chain is whole, the entry point is wrong', () => {
    // This is the pair score's real advantage. 0.8 says "nearly right"; the
    // longest run with nothing in place says "you know the order, you started
    // in the wrong place", which is a different lesson from a swapped pair.
    const rotated = ['anus', 'mouth', 'oesophagus', 'stomach', 'small-intestine', 'large-intestine']
    const g = gradeSequence(DIGESTION, rotated)
    expect(g.inPlace).toBe(0)
    expect(g.longestRun).toBe(5)
    expect(g.offsetOnly).toBe(true)
  })
})

describe('gradeSequence', () => {
  it('scores a perfect answer 1, with every step in place', () => {
    const g = gradeSequence(DIGESTION, [...DIGESTION])
    expect(g.score).toBe(1)
    expect([g.placed, g.of]).toEqual([5, 5])
    expect(g.inPlace).toBe(6)
    expect(g.longestRun).toBe(6)
    expect(g.offsetOnly).toBe(false) // a correct answer is not "merely offset"
  })

  it('costs a single swap three links, and link scoring is HARSHER here', () => {
    // Swapping two adjacent steps breaks three links: into the pair, between
    // the pair (it now runs backwards), and out of the pair. 2 of 5.
    //
    // Worth stating plainly, because it cuts against the framing: link scoring
    // is not uniformly kinder than position scoring. Only the two swapped steps
    // leave their slots, so position scoring gives 4/6 = 0.67 while links give
    // 2/5 = 0.4. Links are more sensitive to LOCAL order, which is the whole
    // point of using them — a swap is a real misunderstanding of the sequence,
    // where a rotation is not.
    const swapped = ['mouth', 'oesophagus', 'small-intestine', 'stomach', 'large-intestine', 'anus']
    const g = gradeSequence(DIGESTION, swapped)
    expect([g.placed, g.of]).toEqual([2, 5])
    expect(g.score).toBe(0.4)
    expect(g.inPlace).toBe(4)
    expect(positionScore(DIGESTION, swapped)).toBeCloseTo(4 / 6, 10)
  })

  it('scores a fully reversed answer 0 — no link runs forwards', () => {
    const g = gradeSequence(DIGESTION, [...DIGESTION].reverse())
    expect(g.score).toBe(0)
    expect(g.offsetOnly).toBe(false)
  })

  it('does not punish a half-finished answer for the gap itself', () => {
    // Three placed correctly, the rest untouched. Two links are earned; the
    // three that touch a null are simply not credited.
    const partial = ['mouth', 'oesophagus', 'stomach', null, null, null]
    const g = gradeSequence(DIGESTION, partial)
    expect([g.placed, g.of]).toEqual([2, 5])
    expect(g.longestRun).toBe(3)
  })

  it('handles nothing placed at all without dividing by zero', () => {
    const g = gradeSequence(DIGESTION, [null, null, null, null, null, null])
    expect(g.score).toBe(0)
    expect(g.longestRun).toBe(0)
  })

  it('returns zeros for a sequence too short to have an order', () => {
    expect(gradeSequence(['only'], ['only']).of).toBe(0)
    expect(gradeSequence(['only'], ['only']).score).toBe(0)
    expect(gradeSequence([], []).score).toBe(0)
  })

  it('ignores a key that is not part of this sequence', () => {
    // An item re-authored after an attempt was stored. Degrade, never throw.
    const g = gradeSequence(DIGESTION, ['mouth', 'oesophagus', 'pancreas', 'small-intestine', 'large-intestine', 'anus'])
    expect(g.placed).toBe(3) // mouth→oesophagus, then s4→s5, s5→s6
    expect(() => gradeSequence(DIGESTION, ['ghost'])).not.toThrow()
  })

  it('survives a duplicated step in the authored order rather than throwing', () => {
    // validateSequence rejects this; grading must not crash on it.
    expect(() => gradeSequence(['a', 'b', 'b'], ['a', 'b', 'b'])).not.toThrow()
  })

  it('offsetOnly stays false while the answer is incomplete', () => {
    // A partial answer can have a long clean run and nothing in place, but
    // "you started in the wrong place" is not yet a fair diagnosis.
    const g = gradeSequence(DIGESTION, [null, 'mouth', 'oesophagus', 'stomach', 'small-intestine', 'large-intestine'])
    expect(g.inPlace).toBe(0)
    expect(g.offsetOnly).toBe(false)
  })
})

describe('positionScore', () => {
  it('exists only to show what was rejected', () => {
    // Kept so the comparison in the first test is executable rather than a
    // claim in a comment.
    expect(positionScore(DIGESTION, [...DIGESTION])).toBe(1)
    expect(positionScore([], [])).toBe(0)
  })
})

describe('validateSequence', () => {
  it('passes a real sequence', () => {
    expect(validateSequence(DIGESTION)).toEqual([])
  })

  it('rejects a one-step sequence — there is no order to get wrong', () => {
    expect(validateSequence(['mouth']).join()).toMatch(/at least 2 steps/)
  })

  it('rejects a duplicated step, whose correct order is ambiguous', () => {
    expect(validateSequence(['a', 'b', 'a']).join()).toMatch(/duplicated step/)
  })
})
