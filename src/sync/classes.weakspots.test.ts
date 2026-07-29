import { describe, it, expect } from 'vitest'
import { rollUpClassWeakSpots, type ClassItemRow } from './classes'
import { ALL_ENTRIES } from '../content/loader'

// What the whole CLASS is weak at (migration 0009).
//
// The server deliberately returns per-ITEM counts: skill tags live in
// seed_content.json, so SQL cannot do this roll-up and should not try. The
// point of the test is that it reuses the per-learner definition of "weak"
// rather than inventing a second one.

/** Real item ids carrying a shared skill, so the roll-up has something to group. */
function itemsWithSharedTag(n: number): { ids: string[]; tag: string } {
  const byTag = new Map<string, string[]>()
  for (const e of ALL_ENTRIES) {
    for (const tag of e.item.skill_tags ?? []) {
      if (tag === 'faded-step') continue
      byTag.set(tag, [...(byTag.get(tag) ?? []), e.item.id])
    }
  }
  for (const [tag, ids] of byTag) if (ids.length >= n) return { ids: ids.slice(0, n), tag }
  throw new Error('no skill tag with enough items in the bank')
}

const { ids, tag } = itemsWithSharedTag(3)

const row = (id: string, attempts: number, wrong: number, learners: number): ClassItemRow => ({
  item_id: id,
  attempts,
  wrong,
  learners,
})

describe('rollUpClassWeakSpots', () => {
  it('groups per-item counts into the skill a teacher would reteach', () => {
    const spots = rollUpClassWeakSpots([
      row(ids[0], 10, 6, 3),
      row(ids[1], 10, 5, 2),
    ])
    const found = spots.find((s) => s.tag === tag)
    expect(found, `expected ${tag} to surface`).toBeTruthy()
    expect(found!.attempts).toBe(20)
    expect(found!.wrong).toBe(11)
  })

  it('names the item MOST learners got wrong, not the most-missed item', () => {
    // "Four learners got this one wrong" is a lesson plan. One learner failing
    // the same item six times is a conversation with that learner, and ranking
    // by raw misses would put it top.
    const spots = rollUpClassWeakSpots([
      row(ids[0], 20, 9, 1), // one learner, nine times
      row(ids[1], 20, 8, 4), // four learners
    ])
    const found = spots.find((s) => s.tag === tag)!
    expect(found.worstItemId).toBe(ids[1])
    expect(found.learners).toBe(4)
  })

  it('applies the SAME thresholds as the per-learner view', () => {
    // Thin evidence must not be promoted into a heading that reads "what the
    // class finds hardest" — that is the bug the per-learner version already
    // had once, reporting a learner as weak at the thing she was best at.
    expect(rollUpClassWeakSpots([row(ids[0], 2, 2, 1)])).toEqual([])
    // and a well-attempted skill going FINE is not a weak spot either
    expect(rollUpClassWeakSpots([row(ids[0], 40, 2, 1)])).toEqual([])
  })

  it('returns nothing for an empty class rather than throwing', () => {
    expect(rollUpClassWeakSpots([])).toEqual([])
  })

  it('ignores an item that is no longer in the bank', () => {
    // Attempts outlive content: an item removed after it was answered has no
    // skills to roll up and must not crash the teacher's screen.
    expect(rollUpClassWeakSpots([row('deleted-item-xyz', 30, 20, 3)])).toEqual([])
  })
})
