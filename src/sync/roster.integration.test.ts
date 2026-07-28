import { describe, it, expect, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { mapRosterRows, rollUpDetail, type ItemStatRow, type RosterRow } from './classes'

// Exercises migration 0005 against the LIVE Supabase project: two independent
// anonymous users (a teacher and a learner), a real class, real progress rows,
// and the two SECURITY DEFINER functions the roster now depends on.
//
// The SQL suite (supabase/tests/roster_test.sql) proves the guards against a
// throwaway Postgres. This proves the function actually EXISTS in production
// with the expected signature and grants — the one thing a local database
// cannot tell us, and precisely what breaks if a migration is half-applied.
//
// Skips automatically without credentials. Cleans up after itself.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const configured = Boolean(url && key)

const PROBE = '__roster_probe__'

/** A client with its own isolated anonymous session. */
async function anonClient(tag: string): Promise<SupabaseClient> {
  const c = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `probe-${tag}` },
  })
  const { error } = await c.auth.signInAnonymously()
  if (error) throw new Error(`${tag}: ${error.message}`)
  return c
}

let teacher: SupabaseClient | null = null
let classId: string | null = null

afterAll(async () => {
  // Deleting the class cascades the membership away; the learner's own probe
  // rows are removed by their own client below.
  if (teacher && classId) await teacher.from('classes').delete().eq('id', classId)
})

describe.skipIf(!configured)('roster RPCs — against live Supabase', () => {
  it('aggregates a real learner, and refuses everyone else', async () => {
    teacher = await anonClient('teacher')
    const learner = await anonClient('learner')
    const stranger = await anonClient('stranger')

    const { data: learnerAuth } = await learner.auth.getUser()
    const learnerId = learnerAuth.user!.id

    // --- teacher creates a class, learner joins ---------------------------
    const { data: cls, error: cErr } = await teacher.rpc('create_class', {
      p_name: 'Roster probe',
    })
    expect(cErr, cErr?.message).toBeNull()
    classId = (cls as { id: string }).id
    const joinCode = (cls as { join_code: string }).join_code

    const { error: jErr } = await learner.rpc('join_class', { p_code: joinCode })
    expect(jErr, jErr?.message).toBeNull()

    // --- the learner does some work ---------------------------------------
    const past = new Date(Date.now() - 3 * 86_400_000).toISOString()
    await learner.from('review_state').upsert({
      user_id: learnerId,
      item_id: PROBE,
      box: 5,
      due_at: new Date(Date.now() + 86_400_000).toISOString(),
      streak: 1,
      last_result: true,
      updated_at: past,
    })
    // Distinct timestamps: attempts has a (user_id, item_id, created_at)
    // unique index for replay safety, so two attempts sharing a timestamp are
    // one row, not two.
    const { error: aErr } = await learner.from('attempts').insert([
      { user_id: learnerId, item_id: PROBE, correct: true, ms_taken: 1000, created_at: past },
      {
        user_id: learnerId,
        item_id: PROBE,
        correct: false,
        ms_taken: 1000,
        created_at: new Date(Date.parse(past) + 1000).toISOString(),
      },
    ])
    expect(aErr, aErr?.message).toBeNull()

    // --- the teacher reads the roster -------------------------------------
    const { data: roster, error: rErr } = await teacher.rpc('class_roster', {
      p_class_id: classId,
    })
    expect(rErr, rErr?.message).toBeNull()

    const rows = mapRosterRows((roster ?? []) as RosterRow[])
    const row = rows.find((r) => r.userId === learnerId)
    expect(row, 'learner missing from roster').toBeTruthy()
    expect(row!.seen).toBe(1)
    expect(row!.mastered).toBe(1) // box 5
    expect(row!.attempts).toBe(2)
    expect(row!.accuracyPct).toBe(50)
    expect(row!.lastActiveAt).not.toBeNull()

    // --- per-item detail ---------------------------------------------------
    const { data: stats, error: sErr } = await teacher.rpc('learner_item_stats', {
      p_class_id: classId,
      p_user_id: learnerId,
    })
    expect(sErr, sErr?.message).toBeNull()
    const probe = ((stats ?? []) as ItemStatRow[]).find((s) => s.item_id === PROBE)
    expect(probe, 'probe item missing from detail').toBeTruthy()
    expect(Number(probe!.attempts)).toBe(2)
    expect(Number(probe!.wrong)).toBe(1)

    // the pure roll-up survives real wire data (bigints may arrive as strings)
    const detail = rollUpDetail((stats ?? []) as ItemStatRow[], Date.now())
    expect(detail.accuracyPct).toBe(50)
    expect(Number.isFinite(detail.overallPct)).toBe(true)

    // --- the guards, live --------------------------------------------------
    // a member is not a teacher
    const { error: memberErr } = await learner.rpc('class_roster', {
      p_class_id: classId,
    })
    expect(memberErr, 'a member could read the roster').not.toBeNull()

    // an unrelated user is refused
    const { error: strangerErr } = await stranger.rpc('class_roster', {
      p_class_id: classId,
    })
    expect(strangerErr, 'a stranger could read the roster').not.toBeNull()

    // and cannot read the learner's history either
    const { error: peekErr } = await stranger.rpc('learner_item_stats', {
      p_class_id: classId,
      p_user_id: learnerId,
    })
    expect(peekErr, 'a stranger could read a learner').not.toBeNull()

    // --- avatars (migration 0006) ------------------------------------------
    const { error: avErr } = await learner.rpc('set_avatar', { p_avatar: '🦊' })
    expect(avErr, avErr?.message).toBeNull()

    // THE KEY GUARD, live: profiles has a self-service RLS policy, so a learner
    // can write their own row DIRECTLY and skip the RPC. Whatever lands here is
    // drawn on classmates' and the teacher's screens, so the database — not the
    // client — has to be what refuses it.
    const junk = await learner
      .from('profiles')
      .update({ avatar: 'BUY CHEAP PILLS' })
      .eq('id', learnerId)
    expect(junk.error, 'the database accepted arbitrary avatar text').not.toBeNull()

    // and the real value survived the attempt
    const mine = await learner
      .from('profiles')
      .select('display_name, avatar')
      .eq('id', learnerId)
      .maybeSingle()
    expect(mine.error, mine.error?.message).toBeNull()
    expect((mine.data as { avatar: string }).avatar).toBe('🦊')

    // it reaches the teacher's roster ...
    const { data: roster2 } = await teacher.rpc('class_roster', { p_class_id: classId })
    const withFace = mapRosterRows((roster2 ?? []) as RosterRow[]).find(
      (r) => r.userId === learnerId,
    )
    expect(withFace?.avatar).toBe('🦊')

    // ... and the classmate-facing leaderboard
    const { data: board, error: bErr } = await learner.rpc('class_leaderboard', {
      p_class_id: classId,
      p_since: new Date(Date.now() - 7 * 86_400_000).toISOString(),
    })
    expect(bErr, bErr?.message).toBeNull()
    const boardRow = ((board ?? []) as { user_id: string; avatar: string | null }[]).find(
      (r) => r.user_id === learnerId,
    )
    expect(boardRow?.avatar).toBe('🦊')

    // clearing falls back to the derived face
    await learner.rpc('set_avatar', { p_avatar: null })
    const cleared = await learner
      .from('profiles')
      .select('avatar')
      .eq('id', learnerId)
      .maybeSingle()
    expect((cleared.data as { avatar: string | null }).avatar).toBeNull()

    // --- clean up the learner's probe rows ---------------------------------
    await learner.from('attempts').delete().eq('item_id', PROBE)
    await learner.from('review_state').delete().eq('item_id', PROBE)
  }, 45_000)
})
