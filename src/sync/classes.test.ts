import { describe, it, expect } from 'vitest'
import { rollUp } from './classes'

const NOW = Date.parse('2026-07-26T00:00:00.000Z')
const day = 86_400_000

const member = (id: string) => ({
  user_id: id,
  joined_at: new Date(NOW - 10 * day).toISOString(),
  profiles: { display_name: null },
})

describe('rollUp', () => {
  it('summarises a learner from their review + attempt rows', () => {
    const [row] = rollUp(
      [{ ...member('u1'), profiles: { display_name: 'Aina' } }],
      [
        // mastered, not due
        { user_id: 'u1', item_id: 'ap-001', box: 5, due_at: new Date(NOW + 5 * day).toISOString(), updated_at: new Date(NOW - day).toISOString() },
        // due now
        { user_id: 'u1', item_id: 'ap-002', box: 2, due_at: new Date(NOW - day).toISOString(), updated_at: new Date(NOW - 2 * day).toISOString() },
      ],
      [
        { user_id: 'u1', item_id: 'ap-001', correct: true, created_at: new Date(NOW - day).toISOString() },
        { user_id: 'u1', item_id: 'ap-002', correct: false, created_at: new Date(NOW - day).toISOString() },
      ],
      NOW,
    )

    expect(row.displayName).toBe('Aina')
    expect(row.seen).toBe(2)
    expect(row.mastered).toBe(1)
    expect(row.due).toBe(1)
    expect(row.attempts).toBe(2)
    expect(row.accuracyPct).toBe(50)
  })

  it('reports a learner who joined but never practised', () => {
    const [row] = rollUp([member('u2')], [], [], NOW)
    expect(row.seen).toBe(0)
    expect(row.mastered).toBe(0)
    expect(row.lastActiveAt).toBeNull()
    expect(row.accuracyPct).toBeNull() // not 0% — nothing was attempted
    expect(row.weakestSkills).toEqual([])
  })

  it('keeps learners separate and never mixes their rows', () => {
    const rows = rollUp(
      [member('u1'), member('u2')],
      [
        { user_id: 'u1', item_id: 'ap-001', box: 5, due_at: new Date(NOW + day).toISOString(), updated_at: new Date(NOW - day).toISOString() },
        { user_id: 'u2', item_id: 'ap-002', box: 1, due_at: new Date(NOW + day).toISOString(), updated_at: new Date(NOW - day).toISOString() },
      ],
      [],
      NOW,
    )
    const u1 = rows.find((r) => r.userId === 'u1')!
    const u2 = rows.find((r) => r.userId === 'u2')!
    expect(u1.mastered).toBe(1)
    expect(u2.mastered).toBe(0)
    expect(u1.seen).toBe(1)
    expect(u2.seen).toBe(1)
  })

  it('sorts most-recently-active first, never-active last', () => {
    const rows = rollUp(
      [member('stale'), member('fresh'), member('idle')],
      [
        { user_id: 'stale', item_id: 'a', box: 1, due_at: new Date(NOW).toISOString(), updated_at: new Date(NOW - 30 * day).toISOString() },
        { user_id: 'fresh', item_id: 'a', box: 1, due_at: new Date(NOW).toISOString(), updated_at: new Date(NOW - day).toISOString() },
      ],
      [],
      NOW,
    )
    expect(rows.map((r) => r.userId)).toEqual(['fresh', 'stale', 'idle'])
  })

  it('surfaces weakest skills only once there is enough evidence', () => {
    // two wrong answers on one item is below the 3-attempt threshold
    const thin = rollUp(
      [member('u1')],
      [],
      [
        { user_id: 'u1', item_id: 'ap-001', correct: false, created_at: new Date(NOW).toISOString() },
        { user_id: 'u1', item_id: 'ap-001', correct: false, created_at: new Date(NOW - 1).toISOString() },
      ],
      NOW,
    )
    expect(thin[0].weakestSkills).toEqual([])

    // a real accuracy signal: the item's skill tags should now surface
    const thick = rollUp(
      [member('u1')],
      [],
      Array.from({ length: 4 }, (_, i) => ({
        user_id: 'u1',
        item_id: 'ap-001',
        correct: false,
        created_at: new Date(NOW - i).toISOString(),
      })),
      NOW,
    )
    expect(thick[0].weakestSkills.length).toBeGreaterThan(0)
  })
})
