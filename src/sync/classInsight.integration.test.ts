import { describe, it, expect, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { rollUpClassWeakSpots, type ClassItemRow } from './classes'
import { recordProbeUser } from './probeUsers'

// Exercises migration 0009 (class_activity + class_item_stats) against the
// LIVE Supabase project.
//
// supabase/tests/class_insight_test.sql already proves the guards against a
// throwaway Postgres. What only production can tell us is that both functions
// EXIST there with the expected signatures and grants — a missing one answers
// PGRST202, which from the client is indistinguishable from a stale schema
// cache, and is exactly what a half-pasted migration produces.
//
// Skips automatically without credentials. Cleans up its own rows.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const configured = Boolean(url && key)

const PROBE_ITEM = 'dc-006'

async function anonClient(tag: string): Promise<SupabaseClient> {
  const c = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `ci-${tag}` },
  })
  const { data, error } = await c.auth.signInAnonymously()
  if (error) throw new Error(`${tag}: ${error.message}`)
  if (data.user) recordProbeUser(data.user.id, tag)
  return c
}

let teacher: SupabaseClient | null = null
let learner: SupabaseClient | null = null
let classId: string | null = null
let learnerId: string | null = null

afterAll(async () => {
  if (learner && learnerId)
    await learner.from('attempts').delete().eq('user_id', learnerId)
  if (teacher && classId) await teacher.from('classes').delete().eq('id', classId)
})

describe.skipIf(!configured)('class insight — against live Supabase', () => {
  it('reports practice days and class-wide misses, and refuses everyone else', async () => {
    teacher = await anonClient('insight-teacher')
    learner = await anonClient('insight-learner')
    const stranger = await anonClient('insight-stranger')

    const { data: auth } = await learner.auth.getUser()
    learnerId = auth.user!.id

    const { data: cls, error: cErr } = await teacher.rpc('create_class', {
      p_name: 'Class insight probe',
    })
    expect(cErr, cErr?.message).toBeNull()
    classId = (cls as { id: string }).id

    const { error: jErr } = await learner.rpc('join_class', {
      p_code: (cls as { join_code: string }).join_code,
    })
    expect(jErr, jErr?.message).toBeNull()

    // Two wrong attempts on ONE day plus one on another: 2 days, 3 attempts.
    const noon = new Date()
    noon.setUTCHours(12, 0, 0, 0)
    const at = (dayOffset: number, min: number) =>
      new Date(noon.getTime() - dayOffset * 86_400_000 + min * 60_000).toISOString()

    const { error: aErr } = await learner.from('attempts').insert([
      { user_id: learnerId, item_id: PROBE_ITEM, correct: false, chosen: '"Debit"', ms_taken: 800, created_at: at(0, 0) },
      { user_id: learnerId, item_id: PROBE_ITEM, correct: false, chosen: '"Debit"', ms_taken: 800, created_at: at(0, 5) },
      { user_id: learnerId, item_id: PROBE_ITEM, correct: true, chosen: '"Credit"', ms_taken: 800, created_at: at(2, 0) },
    ])
    expect(aErr, aErr?.message).toBeNull()

    // --- the strip -------------------------------------------------------
    const act = await teacher.rpc('class_activity', {
      p_class_id: classId,
      p_tz: 'Asia/Kuala_Lumpur',
    })
    // PGRST202 here = the function is not on prod. That is the failure this
    // test exists for.
    expect(act.error, `class_activity failed: ${act.error?.message}`).toBeNull()
    const rows = (act.data ?? []) as { user_id: string; days: boolean[] }[]
    const mine = rows.find((r) => r.user_id === learnerId)
    expect(mine, 'the learner is missing from class_activity').toBeTruthy()
    expect(mine!.days).toHaveLength(7)
    // Three attempts across two days must read as two days, not three.
    expect(mine!.days.filter(Boolean).length).toBe(2)

    // an unrecognised zone must degrade, not fail the report
    const bogus = await teacher.rpc('class_activity', {
      p_class_id: classId,
      p_tz: 'Not/AZone',
    })
    expect(bogus.error, 'a bad timezone broke the report').toBeNull()

    // --- class-wide misses -------------------------------------------------
    const stats = await teacher.rpc('class_item_stats', { p_class_id: classId })
    expect(stats.error, `class_item_stats failed: ${stats.error?.message}`).toBeNull()
    const items = (stats.data ?? []) as ClassItemRow[]
    const probe = items.find((r) => r.item_id === PROBE_ITEM)
    expect(probe, 'the probe item is missing').toBeTruthy()
    expect(Number(probe!.attempts)).toBe(3)
    expect(Number(probe!.wrong)).toBe(2)
    expect(Number(probe!.learners)).toBe(1)

    // and the client roll-up runs on what production actually returned
    expect(() => rollUpClassWeakSpots(items)).not.toThrow()

    // --- the guards, live --------------------------------------------------
    // a member is not a teacher: these cover the whole class, so unlike
    // learner_item_stats there is no harmless "about myself" reading.
    const asMember = await learner.rpc('class_item_stats', { p_class_id: classId })
    expect(asMember.error, 'a member could read the class figures').not.toBeNull()

    const peek = await stranger.rpc('class_activity', {
      p_class_id: classId,
      p_tz: 'UTC',
    })
    expect(peek.error, "a stranger could read the class's activity").not.toBeNull()

    // owning SOME class is not enough
    const { data: otherCls, error: oErr } = await stranger.rpc('create_class', {
      p_name: 'Foreign insight probe',
    })
    expect(oErr, oErr?.message).toBeNull()
    const otherId = (otherCls as { id: string }).id
    try {
      const foreign = await stranger.rpc('class_item_stats', { p_class_id: classId })
      expect(foreign.error, 'owning a class granted reading another one').not.toBeNull()
    } finally {
      await stranger.from('classes').delete().eq('id', otherId)
    }
  })
})
