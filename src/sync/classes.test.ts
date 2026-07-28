import { describe, it, expect } from 'vitest'
import {
  mapRosterRows,
  recentMisses,
  rollUpDetail,
  weakestSkills,
  type ItemStatRow,
  type RosterRow,
} from './classes'
import { ALL_ITEMS } from '../content/loader'

const NOW = Date.parse('2026-07-28T00:00:00.000Z')
const day = 86_400_000
const iso = (t: number) => new Date(t).toISOString()

const rosterRow = (over: Partial<RosterRow> = {}): RosterRow => ({
  user_id: 'u1',
  display_name: 'Aina',
  joined_at: iso(NOW - 10 * day),
  last_active_at: iso(NOW - day),
  seen: 2,
  mastered: 1,
  due: 1,
  box_counts: [0, 1, 0, 0, 1],
  attempts: 4,
  correct: 3,
  ...over,
})

const stat = (over: Partial<ItemStatRow> = {}): ItemStatRow => ({
  item_id: 'ap-001',
  box: 3,
  due_at: iso(NOW + day),
  attempts: 1,
  wrong: 0,
  last_wrong_at: null,
  last_at: iso(NOW - day),
  ...over,
})

describe('mapRosterRows', () => {
  it('passes the server aggregates through and derives accuracy', () => {
    const [row] = mapRosterRows([rosterRow()])
    expect(row.displayName).toBe('Aina')
    expect(row.seen).toBe(2)
    expect(row.mastered).toBe(1)
    expect(row.due).toBe(1)
    expect(row.attempts).toBe(4)
    expect(row.accuracyPct).toBe(75)
  })

  it('weights mastery from the box histogram, not from a server-side score', () => {
    // boxes are 1..5 and weight is (box-1)/4, so one item in box 5 = 1.0 and
    // one in box 3 = 0.5 — 1.5 weight over the whole bank.
    const [row] = mapRosterRows([
      rosterRow({ box_counts: [0, 0, 1, 0, 1], seen: 2 }),
    ])
    const expected = Math.round((1.5 / ALL_ITEMS.length) * 100)
    expect(row.masteryPct).toBe(expected)
  })

  it('a learner who never practised reads as unknown, not as zero percent', () => {
    const [row] = mapRosterRows([
      rosterRow({
        display_name: null,
        last_active_at: null,
        seen: 0,
        mastered: 0,
        due: 0,
        box_counts: [0, 0, 0, 0, 0],
        attempts: 0,
        correct: 0,
      }),
    ])
    expect(row.lastActiveAt).toBeNull()
    expect(row.accuracyPct).toBeNull() // not 0% — nothing was attempted
    expect(row.masteryPct).toBe(0)
    expect(row.displayName).toBeNull()
  })

  it('treats a blank display name as no name at all', () => {
    const [row] = mapRosterRows([rosterRow({ display_name: '   ' })])
    expect(row.displayName).toBeNull()
  })

  it('tolerates postgres bigints arriving as strings', () => {
    // supabase-js hands back bigint columns as strings in some setups; the
    // percentages must not become NaN or string-concatenate.
    const [row] = mapRosterRows([
      {
        ...rosterRow(),
        seen: '2' as unknown as number,
        attempts: '4' as unknown as number,
        correct: '3' as unknown as number,
        box_counts: ['0', '1', '0', '0', '1'] as unknown as number[],
      },
    ])
    expect(row.seen).toBe(2)
    expect(row.accuracyPct).toBe(75)
    expect(Number.isFinite(row.masteryPct)).toBe(true)
  })
})

describe('rollUpDetail', () => {
  it('reports per-topic progress using the learner’s own computation', () => {
    const detail = rollUpDetail([stat()], NOW)
    // every topic is represented, so a teacher sees untouched topics too
    expect(detail.topics.length).toBeGreaterThan(1)
    expect(detail.seen).toBe(1)
    const touched = detail.topics.find((t) =>
      t.topic.lessons.some((l) => l.items.some((i) => i.id === 'ap-001')),
    )!
    expect(touched.seen).toBe(1)
  })

  it('derives accuracy across every item, counting repeats', () => {
    const detail = rollUpDetail(
      [
        stat({ item_id: 'ap-001', attempts: 3, wrong: 1, last_wrong_at: iso(NOW - day) }),
        stat({ item_id: 'ap-002', attempts: 1, wrong: 0 }),
      ],
      NOW,
    )
    expect(detail.attempts).toBe(4)
    expect(detail.accuracyPct).toBe(75)
  })

  it('an item answered but with no review row still counts toward accuracy', () => {
    const detail = rollUpDetail(
      [stat({ box: null, due_at: null, attempts: 2, wrong: 2, last_wrong_at: iso(NOW) })],
      NOW,
    )
    expect(detail.attempts).toBe(2)
    expect(detail.accuracyPct).toBe(0)
    expect(detail.seen).toBe(0) // never entered the scheduler
  })
})

describe('weakestSkills', () => {
  it('stays quiet until there is enough evidence', () => {
    const thin = weakestSkills([stat({ attempts: 2, wrong: 2 })])
    expect(thin).toEqual([]) // below the 3-attempt threshold
  })

  it('surfaces a tag once the evidence is there, worst first', () => {
    const out = weakestSkills([stat({ attempts: 4, wrong: 3 })])
    expect(out.length).toBeGreaterThan(0)
    expect(out[0].wrongPct).toBe(75)
    expect(out[0].attempts).toBe(4)
  })

  it('never reports a UI mechanic as a weak skill', () => {
    // fd-101 is a faded_step item, so it carries the `faded-step` tag
    const out = weakestSkills([
      stat({ item_id: 'fd-101', attempts: 6, wrong: 6, last_wrong_at: iso(NOW) }),
    ])
    expect(out.map((w) => w.tag)).not.toContain('faded-step')
    // its real skill tags still come through
    expect(out.length).toBeGreaterThan(0)
  })

  it('ignores items with no attempts at all', () => {
    expect(weakestSkills([stat({ attempts: 0, wrong: 0 })])).toEqual([])
  })
})

describe('recentMisses', () => {
  it('lists only real misses, most recent first', () => {
    const out = recentMisses([
      stat({ item_id: 'ap-001', attempts: 2, wrong: 1, last_wrong_at: iso(NOW - 3 * day) }),
      stat({ item_id: 'ap-002', attempts: 2, wrong: 2, last_wrong_at: iso(NOW - day) }),
      stat({ item_id: 'dp-001', attempts: 1, wrong: 0, last_wrong_at: null }),
    ])
    expect(out.map((m) => m.itemId)).toEqual(['ap-002', 'ap-001'])
    expect(out[0].wrong).toBe(2)
  })

  it('carries the bilingual prompt and topic so the card can be read in BM', () => {
    const [miss] = recentMisses([
      stat({ item_id: 'ap-001', attempts: 1, wrong: 1, last_wrong_at: iso(NOW) }),
    ])
    expect(miss.prompt.en.length).toBeGreaterThan(0)
    expect(miss.prompt.ms.length).toBeGreaterThan(0)
    expect(miss.topicTitle?.ms.length).toBeGreaterThan(0)
  })

  it('survives an item id that is no longer in the content bank', () => {
    const [miss] = recentMisses([
      stat({ item_id: 'deleted-99', attempts: 1, wrong: 1, last_wrong_at: iso(NOW) }),
    ])
    expect(miss.itemId).toBe('deleted-99')
    expect(miss.topicTitle).toBeNull()
  })
})
