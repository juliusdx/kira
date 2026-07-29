import { describe, it, expect } from 'vitest'
import {
  mapRosterRows,
  recentMisses,
  rollUpDetail,
  siblingCount,
  weakestSkills,
  type ItemStatRow,
  type RosterRow,
} from './classes'
import { ALL_ITEMS, getItem } from '../content/loader'

const NOW = Date.parse('2026-07-28T00:00:00.000Z')
const day = 86_400_000
const iso = (t: number) => new Date(t).toISOString()

const rosterRow = (over: Partial<RosterRow> = {}): RosterRow => ({
  user_id: 'u1',
  display_name: 'Aina',
  avatar: null,
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
    expect(row.avatar).toBeNull()
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

  // Regression, from a real roster card: ranking by error rate alone and
  // taking the top 3 listed a tag at 1-wrong-in-10 under "Needs work" —
  // reporting a learner as weak at the thing she was best at.
  it('does not call a mostly-correct skill weak just to fill three slots', () => {
    // dc-00x are tagged `debit-credit` only; ta-003 is tagged ledger+receivable
    const out = weakestSkills([
      // struggling: 3 wrong in 5
      stat({ item_id: 'ta-003', attempts: 5, wrong: 3, last_wrong_at: iso(NOW) }),
      // strong: 1 wrong in 10, spread over several debit-credit items
      stat({ item_id: 'dc-001', attempts: 4, wrong: 1, last_wrong_at: iso(NOW) }),
      stat({ item_id: 'dc-002', attempts: 3, wrong: 0 }),
      stat({ item_id: 'dc-003', attempts: 3, wrong: 0 }),
    ])
    const tags = out.map((w) => w.tag)
    expect(tags).toContain('ledger')
    expect(tags, 'a 90%-correct skill was reported as needing work').not.toContain(
      'debit-credit',
    )
  })

  it('needs a real sample, not one unlucky answer', () => {
    // 1 wrong out of 3 is 33% — over the rate bar but too thin to trust
    expect(weakestSkills([stat({ attempts: 3, wrong: 1 })])).toEqual([])
  })

  it('says nothing at all when nothing stands out', () => {
    const out = weakestSkills([stat({ attempts: 20, wrong: 1 })])
    expect(out).toEqual([]) // the card hides rather than inventing a weakness
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
    // The teacher view must render this without the whole card throwing.
    expect(miss.item).toBeNull()
    expect(miss.lessonTitle).toBeNull()
    expect(miss.siblings).toBe(0)
  })

  // The server only ever sends an item id; the item itself is in the bundle.
  // Carrying it is what lets a teacher be shown the actual question, its
  // answer and its explanation with no extra round trip and no new RLS.
  it('carries the whole item, its lesson and its sibling count', () => {
    const [miss] = recentMisses([
      stat({ item_id: 'ap-001', attempts: 1, wrong: 1, last_wrong_at: iso(NOW) }),
    ])
    expect(miss.item?.id).toBe('ap-001')
    expect(miss.item?.explanation.ms.length).toBeGreaterThan(0)
    expect(miss.lessonTitle?.ms.length).toBeGreaterThan(0)
    expect(miss.siblings).toBeGreaterThan(0)
  })
})

describe('recentMisses — the learner’s actual answer (migration 0007)', () => {
  const miss = (lastWrong: Parameters<typeof recentMisses>[2]) =>
    recentMisses(
      [stat({ item_id: 'ta-008', attempts: 3, wrong: 3, last_wrong_at: iso(NOW) })],
      5,
      lastWrong,
    )[0]

  // 0007 is applied BY HAND, so a build reaches users before the function
  // exists. "We were never told" must be distinguishable from "she answered
  // nothing", or the panel claims an answer was not recorded when in fact it
  // has simply not been asked for.
  it('is undefined when the RPC returned nothing at all', () => {
    expect(miss([]).chosen).toBeUndefined()
    expect(recentMisses([stat({ wrong: 1, last_wrong_at: iso(NOW) })])[0].chosen).toBeUndefined()
  })

  it('is null when the attempt predates the client syncing chosen', () => {
    const m = miss([{ item_id: 'ta-008', chosen: null, wrong_at: iso(NOW) }])
    expect(m.chosen).toBeNull()
    expect('chosen' in m).toBe(true) // present, but empty
  })

  it('carries the payload through untouched for the client to interpret', () => {
    const payload = { sides: { 0: 'debit', 1: 'debit' }, balance: 1500 }
    expect(miss([{ item_id: 'ta-008', chosen: payload, wrong_at: iso(NOW) }]).chosen).toEqual(
      payload,
    )
  })

  it('matches answers to the right item, ignoring answers for others', () => {
    const m = miss([
      { item_id: 'dc-006', chosen: '"Debit"', wrong_at: iso(NOW) },
      { item_id: 'ta-008', chosen: { balance: 42 }, wrong_at: iso(NOW) },
    ])
    expect(m.chosen).toEqual({ balance: 42 })
  })
})

describe('siblingCount', () => {
  it('counts other items sharing a teachable skill, excluding the item itself', () => {
    const n = siblingCount('ta-006') // ledger + balancing-off
    expect(n).toBeGreaterThan(0)
    const tags = new Set(getItem('ta-006')?.skill_tags ?? [])
    const expected = ALL_ITEMS.filter(
      (i) => i.id !== 'ta-006' && (i.skill_tags ?? []).some((tag) => tags.has(tag)),
    ).length
    expect(n).toBe(expected)
  })

  // Every faded_step shares `faded-step`, so counting it would report "30 more
  // like this" about the PRESENTATION rather than about the skill.
  it('ignores mechanic tags', () => {
    const withMechanic = ALL_ITEMS.filter((i) =>
      (i.skill_tags ?? []).includes('faded-step'),
    )
    expect(withMechanic.length).toBeGreaterThan(10)
    // fd-1001 is ledger + balancing-off + faded-step; the count must match the
    // real skills only, so it cannot include every other ladder in the bank.
    expect(siblingCount('fd-1001')).toBeLessThan(withMechanic.length)
  })

  it('is 0 for an item that is not in the bank', () => {
    expect(siblingCount('deleted-99')).toBe(0)
  })
})
