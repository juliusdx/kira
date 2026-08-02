import { describe, it, expect } from 'vitest'
import {
  BLUEPRINT,
  EXAM_QUESTIONS,
  buildPaper,
  isMcq,
  scorePaper,
  type PaperQuestion,
} from './paper'
import { ALL_ENTRIES, getItem } from '../content/loader'
import type { ChoiceItem } from '../content/types'

// The shape of a mock Kertas 1. All of this is pure, which is the point: a
// paper that under-represents the syllabus is a flattering lie, and that is
// cheaper to catch here than after a learner has sat it.

const correctFor = (itemId: string, answer: string | null) => {
  const item = getItem(itemId)
  if (!item || answer === null) return false
  return (item as ChoiceItem).answer === answer
}

describe('the blueprint', () => {
  it('asks for exactly a full paper', () => {
    const total = BLUEPRINT.reduce((s, b) => s + b.count, 0)
    expect(total).toBe(EXAM_QUESTIONS)
  })

  it('names only topics that exist and can actually supply MCQ items', () => {
    // A blueprint entry pointing at a renamed topic would silently shrink the
    // paper — the redistribution would paper over it.
    const available = new Map<string, number>()
    for (const e of ALL_ENTRIES)
      if (isMcq(e)) available.set(e.topicId, (available.get(e.topicId) ?? 0) + 1)

    for (const b of BLUEPRINT) {
      expect(available.get(b.topicId), `${b.topicId} has no MCQ items`).toBeTruthy()
      expect(
        available.get(b.topicId)!,
        `${b.topicId} wants ${b.count} but the bank holds ${available.get(b.topicId)}`,
      ).toBeGreaterThanOrEqual(b.count)
    }
  })
})

describe('buildPaper', () => {
  it('produces a full-length paper', () => {
    expect(buildPaper(1)).toHaveLength(EXAM_QUESTIONS)
  })

  it('never repeats a question', () => {
    for (const seed of [1, 2, 99, 12345]) {
      const ids = buildPaper(seed).map((q) => q.itemId)
      expect(new Set(ids).size, `seed ${seed} repeated an item`).toBe(ids.length)
    }
  })

  it('is deterministic — the same seed rebuilds the same paper', () => {
    // Load-bearing: the review screen rebuilds the paper from its seed rather
    // than storing the questions twice.
    expect(buildPaper(4242)).toEqual(buildPaper(4242))
  })

  it('gives a different paper for a different seed', () => {
    const a = buildPaper(1).map((q) => q.itemId)
    const b = buildPaper(2).map((q) => q.itemId)
    expect(a).not.toEqual(b)
  })

  it('asks only multiple-choice questions', () => {
    // A T-account in a 40-question, 75-minute paper would wreck the time
    // budget and stop it being a Kertas 1.
    for (const q of buildPaper(7)) {
      const item = getItem(q.itemId)
      expect(item, q.itemId).toBeTruthy()
      expect(['classify', 'debit_credit'], q.itemId).toContain(item!.type)
    }
  })

  it('honours the blueprint per topic', () => {
    const paper = buildPaper(11)
    const got = new Map<string, number>()
    for (const q of paper) got.set(q.topicId, (got.get(q.topicId) ?? 0) + 1)
    for (const b of BLUEPRINT) {
      expect(got.get(b.topicId) ?? 0, `${b.topicId}`).toBeGreaterThanOrEqual(b.count)
    }
  })

  it('runs in syllabus order, as the real paper does', () => {
    const rank = new Map(BLUEPRINT.map((b, i) => [b.topicId, i]))
    const order = buildPaper(3).map((q) => rank.get(q.topicId) ?? 99)
    expect([...order]).toEqual([...order].sort((a, b) => a - b))
  })

  it('still fills the paper when a topic cannot supply its allocation', () => {
    // Redistribution: strip one blueprint topic down to a single item and the
    // paper must still come out full length rather than 37 questions long.
    const thin = ALL_ENTRIES.filter(
      (e) => e.topicId !== 't22-documents' || e.item.id === 'sd-001',
    )
    const paper = buildPaper(5, thin)
    expect(paper).toHaveLength(EXAM_QUESTIONS)
    expect(new Set(paper.map((q) => q.itemId)).size).toBe(EXAM_QUESTIONS)
  })

  it('does not hang when the bank cannot fill a paper at all', () => {
    // Better a short paper than an infinite loop.
    const tiny = ALL_ENTRIES.filter(isMcq).slice(0, 5)
    const paper = buildPaper(1, tiny)
    expect(paper.length).toBeLessThanOrEqual(5)
  })
})

describe('scorePaper', () => {
  const paper: PaperQuestion[] = [
    { itemId: 'a', topicId: 't1' },
    { itemId: 'b', topicId: 't1' },
    { itemId: 'c', topicId: 't2' },
  ]
  const key: Record<string, string> = { a: 'A', b: 'B', c: 'C' }
  const check = (id: string, ans: string | null) => ans !== null && key[id] === ans

  it('marks the paper and reports a whole percent', () => {
    const s = scorePaper(paper, ['A', 'X', 'C'], check)
    expect(s.correct).toBe(2)
    expect(s.total).toBe(3)
    expect(s.pct).toBe(67)
  })

  it('counts a blank as wrong but reports it separately', () => {
    // Running out of time and not knowing the answer need different advice,
    // so the score cannot be the only number reported.
    const s = scorePaper(paper, ['A', null, null], check)
    expect(s.correct).toBe(1)
    expect(s.unanswered).toBe(2)
  })

  it('breaks down by topic, worst first', () => {
    const s = scorePaper(paper, ['A', 'X', 'C'], check)
    expect(s.byTopic[0].topicId).toBe('t1') // 1/2
    expect(s.byTopic[0]).toEqual({ topicId: 't1', correct: 1, total: 2 })
    expect(s.byTopic[1]).toEqual({ topicId: 't2', correct: 1, total: 1 })
  })

  it('handles a paper answered entirely blank', () => {
    const s = scorePaper(paper, [null, null, null], check)
    expect(s.correct).toBe(0)
    expect(s.pct).toBe(0)
    expect(s.unanswered).toBe(3)
  })

  it('marks a real paper against the real answer keys', () => {
    // End to end on actual content: answering every question correctly scores
    // full marks, which also proves the paper only contains gradeable items.
    const paper = buildPaper(21)
    const answers = paper.map((q) => (getItem(q.itemId) as ChoiceItem).answer)
    const s = scorePaper(paper, answers, correctFor)
    expect(s.correct).toBe(EXAM_QUESTIONS)
    expect(s.pct).toBe(100)
    expect(s.unanswered).toBe(0)
  })
})
