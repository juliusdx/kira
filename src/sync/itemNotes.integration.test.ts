import { describe, it, expect, afterAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { recordProbeUser } from './probeUsers'

// Exercises migration 0008 (`item_notes`) against the LIVE Supabase project.
//
// supabase/tests/item_notes_test.sql already proves the policy against a
// throwaway Postgres. What only production can tell us is whether the table
// exists there WITH RLS ENABLED and the grants applied — and that pairing is
// the one that matters here. A table created without `enable row level
// security` is readable by every holder of the publishable key, which is to
// say by anyone who opens the app, and from the client it looks like a working
// feature. So the load-bearing assertion below is not "a teacher can save a
// note"; it is "a second account cannot read it".
//
// Skips automatically without credentials. Cleans up its own rows.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const configured = Boolean(url && key)

const PROBE_ITEM = 'l30-balance-off'
const SECRET = 'PROBE_NOTE_a7f3 — the balance c/d goes on the smaller side.'

async function anonClient(tag: string): Promise<SupabaseClient> {
  const c = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: `in-${tag}` },
  })
  const { data, error } = await c.auth.signInAnonymously()
  if (error) throw new Error(`${tag}: ${error.message}`)
  // The auth user outlives this test — only a service_role key can delete it.
  if (data.user) recordProbeUser(data.user.id, tag)
  return c
}

let teacher: SupabaseClient | null = null
let teacherId: string | null = null

afterAll(async () => {
  if (teacher && teacherId)
    await teacher.from('item_notes').delete().eq('author_id', teacherId)
})

describe.skipIf(!configured)('item_notes — against live Supabase', () => {
  it('saves a note, keeps it private, and clears it', async () => {
    teacher = await anonClient('note-author')
    const other = await anonClient('note-reader')

    const { data: auth } = await teacher.auth.getUser()
    teacherId = auth.user!.id

    // --- write -------------------------------------------------------------
    // A missing table surfaces here as PGRST205 — the failure a migration
    // that was never pasted produces, and one reason this test exists.
    const { data: written, error: wErr } = await teacher
      .from('item_notes')
      .upsert(
        { author_id: teacherId, item_id: PROBE_ITEM, note: SECRET },
        { onConflict: 'author_id,item_id' },
      )
      .select('item_id, note, updated_at')
    expect(wErr, `insert failed: ${wErr?.message}`).toBeNull()
    expect(written, 'the write returned no row — RLS filtered it out').toHaveLength(1)
    expect(written![0].note).toBe(SECRET)

    // updated_at is the server's clock, not ours
    const age = Date.now() - Date.parse(written![0].updated_at as string)
    expect(Math.abs(age)).toBeLessThan(5 * 60_000)

    // --- read back ---------------------------------------------------------
    const { data: mine, error: rErr } = await teacher
      .from('item_notes')
      .select('note')
      .in('item_id', [PROBE_ITEM])
    expect(rErr, rErr?.message).toBeNull()
    expect(mine).toHaveLength(1)

    // --- THE assertion: nobody else can read it ----------------------------
    // If RLS were off on this table, this returns the note and the test fails
    // loudly rather than the leak sitting there looking like a feature.
    const { data: theirs, error: oErr } = await other
      .from('item_notes')
      .select('note')
    expect(oErr, oErr?.message).toBeNull()
    expect(
      (theirs ?? []).some((r) => (r as { note: string }).note === SECRET),
      'ANOTHER ACCOUNT COULD READ THE NOTE — check that RLS is enabled on item_notes',
    ).toBe(false)

    // nor write one under someone else's name
    const { error: forgeErr } = await other
      .from('item_notes')
      .insert({ author_id: teacherId, item_id: PROBE_ITEM, note: 'PLANTED' })
    expect(forgeErr, 'a note could be authored on another account').not.toBeNull()

    // --- the length bound is the database's, not the client's --------------
    const { error: longErr } = await teacher
      .from('item_notes')
      .insert({ author_id: teacherId, item_id: 'probe-oversize', note: 'x'.repeat(2001) })
    expect(longErr, 'a 2001-character note was accepted').not.toBeNull()

    // --- clear -------------------------------------------------------------
    const { error: dErr } = await teacher
      .from('item_notes')
      .delete()
      .eq('author_id', teacherId)
      .eq('item_id', PROBE_ITEM)
    expect(dErr, dErr?.message).toBeNull()
    const { data: after } = await teacher
      .from('item_notes')
      .select('note')
      .in('item_id', [PROBE_ITEM])
    expect(after ?? []).toHaveLength(0)
  })
})
