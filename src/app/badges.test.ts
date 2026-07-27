import { describe, it, expect } from 'vitest'
import {
  bestRun,
  comebackCount,
  computeBadges,
  newlyEarned,
  type AttemptLite,
} from './badges'
import { MAX_BOX, type ReviewState } from '../scheduler/scheduler'

const NOW = Date.parse('2026-07-27T00:00:00.000Z')
const day = 86_400_000

function state(box: number, dueIn = day): ReviewState {
  return {
    box,
    dueAt: NOW + dueIn,
    streak: 0,
    lastResult: true,
    updatedAt: NOW - day,
  }
}

function attempt(itemId: string, correct: boolean, i: number): AttemptLite {
  return { itemId, correct, createdAt: NOW - day + i * 1000 }
}

const find = (bs: ReturnType<typeof computeBadges>, id: string) =>
  bs.find((b) => b.id === id)!

describe('bestRun', () => {
  it('finds the longest streak of correct answers', () => {
    const a = [
      attempt('a', true, 0),
      attempt('b', true, 1),
      attempt('c', false, 2),
      attempt('d', true, 3),
      attempt('e', true, 4),
      attempt('f', true, 5),
    ]
    expect(bestRun(a)).toBe(3)
  })

  it('is order-independent of how rows arrive', () => {
    // attempts come back from the cloud unordered
    const a = [attempt('c', false, 2), attempt('b', true, 1), attempt('a', true, 0)]
    expect(bestRun(a)).toBe(2)
  })

  it('is 0 with no attempts, and 0 when everything is wrong', () => {
    expect(bestRun([])).toBe(0)
    expect(bestRun([attempt('a', false, 0)])).toBe(0)
  })
})

describe('comebackCount', () => {
  it('counts an item missed twice that is now well established', () => {
    const attempts = [
      attempt('x', false, 0),
      attempt('x', false, 1),
      attempt('x', true, 2),
    ]
    const map = new Map([['x', state(4)]])
    expect(comebackCount(attempts, map)).toBe(1)
  })

  it('does not count an item missed only once', () => {
    const attempts = [attempt('x', false, 0)]
    expect(comebackCount(attempts, new Map([['x', state(5)]]))).toBe(0)
  })

  it('does not count an item still languishing in a low box', () => {
    const attempts = [attempt('x', false, 0), attempt('x', false, 1)]
    expect(comebackCount(attempts, new Map([['x', state(2)]]))).toBe(0)
  })
})

describe('computeBadges', () => {
  it('reports progress toward an unearned badge', () => {
    const map = new Map([
      ['a', state(MAX_BOX)],
      ['b', state(MAX_BOX)],
    ])
    const b = find(computeBadges(map, [], NOW), 'mastered-10')
    expect(b.earned).toBe(false)
    expect(b.have).toBe(2)
    expect(b.need).toBe(10)
  })

  it('earns first-mastery on a single top-box item', () => {
    const map = new Map([['a', state(MAX_BOX)]])
    expect(find(computeBadges(map, [], NOW), 'first-mastery').earned).toBe(true)
  })

  it('awards caught-up only when something has been seen AND nothing is due', () => {
    // a brand-new learner has nothing due, but is not "caught up"
    expect(find(computeBadges(new Map(), [], NOW), 'caught-up').earned).toBe(false)

    const notDue = new Map([['a', state(3, day)]])
    expect(find(computeBadges(notDue, [], NOW), 'caught-up').earned).toBe(true)

    const overdue = new Map([['a', state(3, -day)]])
    expect(find(computeBadges(overdue, [], NOW), 'caught-up').earned).toBe(false)
  })

  it('earns a topic badge only when every item in it is mastered', () => {
    // t9-accruals has 12 items; mastering one is not enough
    const partial = new Map([['ap-001', state(MAX_BOX)]])
    const b = find(computeBadges(partial, [], NOW), 'topic-t9-accruals')
    expect(b.earned).toBe(false)
    expect(b.have).toBe(1)
    expect(b.need).toBeGreaterThan(1)
  })

  it('every badge has both languages', () => {
    for (const b of computeBadges(new Map(), [], NOW)) {
      expect(b.name.en, b.id).toBeTruthy()
      expect(b.name.ms, b.id).toBeTruthy()
      expect(b.desc.en, b.id).toBeTruthy()
      expect(b.desc.ms, b.id).toBeTruthy()
      expect(b.emoji, b.id).toBeTruthy()
    }
  })
})

describe('newlyEarned', () => {
  it('returns only badges that flipped to earned', () => {
    const before = computeBadges(new Map(), [], NOW)
    const after = computeBadges(new Map([['a', state(MAX_BOX)]]), [], NOW)
    const fresh = newlyEarned(before, after).map((b) => b.id)
    expect(fresh).toContain('first-mastery')
  })

  it('does not re-announce a badge already held', () => {
    const map = new Map([['a', state(MAX_BOX)]])
    const same = computeBadges(map, [], NOW)
    expect(newlyEarned(same, same)).toEqual([])
  })
})
