import { getSupabase } from './client'

// The teacher's own better explanation for an item (migration 0008).
//
// Author-scoped, not learner-scoped: a better explanation for `l30-balance-off`
// is a better explanation for it whoever missed it, so writing it once is
// enough. Nobody but the author ever reads a note — see the migration for why
// that is a security decision and not just a simplification.
//
// Cloud-only, deliberately. Everything a learner does is local-first in Dexie
// because a learner must be able to practise on a bus with no signal; the
// teacher's screen is already an RPC round-trip before it can render anything
// at all, so there is nothing for a local copy of a note to make usable.

/** Matches the CHECK constraint in 0008 — the server is the real bound. */
export const NOTE_MAX = 2000

/**
 * The notes this teacher has written for the given items.
 *
 * Bounded input by construction: it is called with the ids of the (at most 5)
 * recent misses on screen, never with the whole bank, so the `.in()` here
 * cannot grow into the row-cap truncation bug that took out the roster.
 *
 * Returns an empty map rather than throwing when 0008 has not been applied
 * yet: a deploy reaches users before Julius pastes the SQL, and a missing
 * table must not take the whole learner-detail screen down with it. Same
 * tolerance `learner_last_wrong` has.
 */
export async function getItemNotes(
  itemIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (itemIds.length === 0) return out
  const pending = getSupabase()
  if (!pending) return out
  const supabase = await pending

  const { data, error } = await supabase
    .from('item_notes')
    .select('item_id, note')
    .in('item_id', itemIds)
  // RLS already restricts this to the caller's own rows; no author filter is
  // needed and adding one would imply the policy were optional.
  if (error || !data) return out

  for (const row of data as { item_id: string; note: string }[]) {
    out.set(row.item_id, row.note)
  }
  return out
}

export type SaveResult = 'saved' | 'cleared' | 'failed'

/**
 * Write (or clear) the note for one item.
 *
 * An empty note DELETES the row instead of storing an empty string, so
 * "cleared" and "never written" stay the same state — the CHECK constraint in
 * 0008 refuses the alternative anyway.
 *
 * Never reports success it has not observed. That is the clipboard lesson
 * generalised, and it bites twice as hard here: PostgREST answers an
 * RLS-filtered write with 204 rather than 403, so a permissive status is not
 * evidence the row landed. The upsert therefore asks for the row back and only
 * calls it saved if one returns.
 */
export async function saveItemNote(
  userId: string,
  itemId: string,
  note: string,
): Promise<SaveResult> {
  const pending = getSupabase()
  if (!pending) return 'failed'
  const supabase = await pending
  const clean = note.trim().slice(0, NOTE_MAX)

  if (clean === '') {
    const { error } = await supabase
      .from('item_notes')
      .delete()
      .eq('author_id', userId)
      .eq('item_id', itemId)
    return error ? 'failed' : 'cleared'
  }

  const { data, error } = await supabase
    .from('item_notes')
    .upsert(
      { author_id: userId, item_id: itemId, note: clean },
      { onConflict: 'author_id,item_id' },
    )
    .select('item_id')
  if (error || !data || data.length === 0) return 'failed'
  return 'saved'
}
