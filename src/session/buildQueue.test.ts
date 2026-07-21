import { describe, it, expect } from 'vitest'
import { buildQueue, interleaveByType } from './buildQueue'
import type { ItemIndexEntry, ItemType } from '../content/types'
import { initialReview, schedule, type ReviewState } from '../scheduler/scheduler'

const T0 = 1_700_000_000_000
const DAY = 24 * 60 * 60 * 1000

function entry(id: string, type: ItemType, order: number): ItemIndexEntry {
  return {
    item: {
      id, type, difficulty: 1, skill_tags: [],
      prompt: { en: '', ms: '' }, explanation: { en: '', ms: '' },
      // minimal shape; buildQueue only reads id/type/order
      data: {}, answer: '',
    } as unknown as ItemIndexEntry['item'],
    topicId: 't', lessonId: 'l', order,
  }
}

describe('buildQueue — new item selection', () => {
  const entries = [
    entry('a', 'classify', 0),
    entry('b', 'classify', 1),
    entry('c', 'classify', 2),
    entry('d', 'classify', 3),
    entry('e', 'classify', 4),
    entry('f', 'classify', 5),
  ]

  it('caps new items at maxNew and takes them in content order', () => {
    const { queue, newIds } = buildQueue(entries, new Map(), T0, { maxNew: 4, maxDue: 12 })
    expect(queue).toHaveLength(4)
    expect(newIds.size).toBe(4)
    expect(queue.map((e) => e.item.id)).toEqual(['a', 'b', 'c', 'd'])
  })
})

describe('buildQueue — due vs not-yet-due', () => {
  it('includes only items whose dueAt ≤ now', () => {
    const entries = [entry('a', 'classify', 0), entry('b', 'classify', 1)]
    const state = new Map<string, ReviewState>()
    // a answered correctly -> box 2, due in 1 day (NOT due now)
    state.set('a', schedule(initialReview(T0), true, T0))
    // b answered wrong -> box 1, due now
    state.set('b', schedule(initialReview(T0), false, T0))

    const { queue, newIds } = buildQueue(entries, state, T0, { maxNew: 4, maxDue: 12 })
    expect(queue.map((e) => e.item.id)).toEqual(['b'])
    expect(newIds.size).toBe(0)

    // a day later, a becomes due too
    const later = buildQueue(entries, state, T0 + DAY, { maxNew: 4, maxDue: 12 })
    expect(later.queue.map((e) => e.item.id).sort()).toEqual(['a', 'b'])
  })

  it('due items come before brand-new ones', () => {
    const entries = [entry('new1', 'classify', 0), entry('due1', 'numeric', 1)]
    const state = new Map<string, ReviewState>()
    state.set('due1', { ...initialReview(T0), dueAt: T0 - DAY }) // overdue
    const { queue } = buildQueue(entries, state, T0)
    expect(queue[0].item.id).toBe('due1')
  })
})

describe('interleaveByType', () => {
  it('never batches one type when others remain', () => {
    const pool = [
      entry('a1', 'classify', 0),
      entry('a2', 'classify', 1),
      entry('a3', 'classify', 2),
      entry('b1', 'numeric', 3),
      entry('b2', 'numeric', 4),
    ]
    const out = interleaveByType(pool).map((e) => e.item.type)
    // no two adjacent identical until one type is exhausted
    // classify=3, numeric=2 -> C N C N C  (valid alternation)
    expect(out).toEqual(['classify', 'numeric', 'classify', 'numeric', 'classify'])
  })

  it('preserves priority order within a type bucket', () => {
    const pool = [
      entry('c1', 'classify', 0),
      entry('c2', 'classify', 1),
      entry('n1', 'numeric', 2),
    ]
    const out = interleaveByType(pool).map((e) => e.item.id)
    expect(out.indexOf('c1')).toBeLessThan(out.indexOf('c2'))
  })
})
