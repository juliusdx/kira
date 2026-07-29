import { describe, it, expect, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { recentMisses, type ItemStatRow, type LastWrongRow } from './classes'
import { describeChosen } from '../lib/chosenAnswer'
import { getItem } from '../content/loader'
import type { Item } from '../content/types'
import { recordProbeUser } from './probeUsers'

// Exercises migration 0007 (`learner_last_wrong`) against the LIVE Supabase
// project.
//
// supabase/tests/last_wrong_test.sql already proves the guard against a
// throwaway Postgres. What only production can tell us is whether the function
// EXISTS there with the expected signature and grants — which is exactly what
// a half-applied migration breaks, and what looks identical to a stale
// PostgREST schema cache from the client side.
//
// Skips automatically without credentials. Cleans up after itself.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const configured = Boolean(url && key)

// A real item, so the answer payload is one the client can actually read back.
const PROBE_ITEM = 'ta-008'
const t = (k: 'debit' | 'credit' | 'closingBalance' | 'yourAnswer') => k

async function anonClient(tag: string): Promise<SupabaseClient> {
  const c = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `lw-${tag}` },
  })
  const { data, error } = await c.auth.signInAnonymously()
  if (error) throw new Error(`${tag}: ${error.message}`)
  // The auth user outlives this test — only a service_role key can delete it.
  // Record the id so cleanup is a lookup rather than a guess.
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

describe.skipIf(!configured)('learner_last_wrong — against live Supabase', () => {
  it('returns the latest wrong answer, and refuses everyone else', async () => {
    teacher = await anonClient('teacher')
    learner = await anonClient('learner')
    const stranger = await anonClient('stranger')

    const { data: auth } = await learner.auth.getUser()
    learnerId = auth.user!.id

    const { data: cls, error: cErr } = await teacher.rpc('create_class', {
      p_name: 'Last-wrong probe',
    })
    expect(cErr, cErr?.message).toBeNull()
    classId = (cls as { id: string }).id

    const { error: jErr } = await learner.rpc('join_class', {
      p_code: (cls as { join_code: string }).join_code,
    })
    expect(jErr, jErr?.message).toBeNull()

    // Two wrong attempts and one correct, at distinct timestamps (attempts has
    // a (user_id, item_id, created_at) unique index for replay safety).
    const t0 = Date.now() - 3 * 86_400_000
    const older = {
      sides: { 0: 'debit', 1: 'debit', 2: 'debit' },
      balance: 3500,
    }
    const latest = {
      sides: { 0: 'debit', 1: 'debit', 2: 'credit' },
      balance: 1500,
    }
    const { error: aErr } = await learner.from('attempts').insert([
      {
        user_id: learnerId,
        item_id: PROBE_ITEM,
        correct: false,
        chosen: older,
        ms_taken: 900,
        created_at: new Date(t0).toISOString(),
      },
      {
        user_id: learnerId,
        item_id: PROBE_ITEM,
        correct: false,
        chosen: latest,
        ms_taken: 900,
        created_at: new Date(t0 + 60_000).toISOString(),
      },
      // A CORRECT attempt, most recent of all — it must not be reported.
      {
        user_id: learnerId,
        item_id: PROBE_ITEM,
        correct: true,
        chosen: { sides: { 0: 'debit', 1: 'credit', 2: 'credit' }, balance: 500 },
        ms_taken: 900,
        created_at: new Date(t0 + 120_000).toISOString(),
      },
    ])
    expect(aErr, aErr?.message).toBeNull()

    // --- the teacher reads it ---------------------------------------------
    const { data, error } = await teacher.rpc('learner_last_wrong', {
      p_class_id: classId,
      p_user_id: learnerId,
    })
    // A missing function surfaces as PGRST202 here — the exact failure a
    // half-applied migration produces, and the reason this test exists.
    expect(error, `learner_last_wrong failed: ${error?.message}`).toBeNull()

    const rows = (data ?? []) as LastWrongRow[]
    const row = rows.find((r) => r.item_id === PROBE_ITEM)
    expect(row, 'the probe item is missing from the result').toBeTruthy()

    // the LATEST wrong one, not the first, and not the later correct one
    expect((row!.chosen as typeof latest).balance).toBe(1500)
    expect((row!.chosen as typeof latest).sides[2]).toBe('credit')
    expect(rows.filter((r) => r.item_id === PROBE_ITEM)).toHaveLength(1)

    // --- and the client can read the payload back -------------------------
    // The end-to-end point: jsonb written by the app, through Postgres, back
    // out, and turned into the lines a teacher actually sees.
    const item = getItem(PROBE_ITEM) as Item
    const lines = describeChosen(item, row!.chosen, 'en', t)
    expect(lines, 'the stored payload was unreadable').not.toBeNull()
    const wrongParts = lines!.filter((l) => !l.ok).map((l) => l.label)
    expect(wrongParts).toContain('Cash received from customer')
    expect(wrongParts).toContain('closingBalance')

    // and it reaches the panel through the same path the UI uses
    const stats: ItemStatRow[] = [
      {
        item_id: PROBE_ITEM,
        box: 1,
        due_at: new Date().toISOString(),
        attempts: 3,
        wrong: 2,
        last_wrong_at: new Date(t0 + 60_000).toISOString(),
        last_at: new Date(t0 + 120_000).toISOString(),
      },
    ]
    const [miss] = recentMisses(stats, 5, rows)
    expect(miss.itemId).toBe(PROBE_ITEM)
    expect((miss.chosen as typeof latest).balance).toBe(1500)

    // --- the guards, live --------------------------------------------------
    // the learner cannot read their own answers through the teacher path
    const own = await learner.rpc('learner_last_wrong', {
      p_class_id: classId,
      p_user_id: learnerId,
    })
    expect(own.error, 'a member could call the teacher path').not.toBeNull()

    // a stranger cannot read the learner
    const peek = await stranger.rpc('learner_last_wrong', {
      p_class_id: classId,
      p_user_id: learnerId,
    })
    expect(peek.error, "a stranger could read a learner's answers").not.toBeNull()

    // owning SOME class is not enough: the stranger makes a real class of their
    // own and asks about a learner who is not in it.
    const { data: otherCls, error: oErr } = await stranger.rpc('create_class', {
      p_name: 'Foreign probe',
    })
    expect(oErr, oErr?.message).toBeNull()
    const otherId = (otherCls as { id: string }).id
    try {
      const foreign = await stranger.rpc('learner_last_wrong', {
        p_class_id: otherId,
        p_user_id: learnerId,
      })
      expect(
        foreign.error,
        'owning a class granted reading a learner outside it',
      ).not.toBeNull()
    } finally {
      await stranger.from('classes').delete().eq('id', otherId)
    }
  })
})
