import { describe, it, expect, vi, beforeEach } from 'vitest'

// The teacher's saved note (migration 0008). Two behaviours are load-bearing
// and both are about NOT lying to the teacher:
//
//   1. a write is only reported as saved when a row actually came back —
//      PostgREST answers an RLS-filtered write with 204, not 403, so status
//      alone proves nothing;
//   2. the table being absent (0008 not pasted yet) degrades to "no notes"
//      rather than taking the learner-detail screen down.

const state = {
  rows: [] as { author_id: string; item_id: string; note: string }[],
  // set to simulate 0008 not yet applied
  missingTable: false,
  // set to simulate RLS filtering the write out (the 204-not-403 case)
  writeFilteredOut: false,
  lastDelete: null as { author: string; item: string } | null,
}

const ERR = { message: 'relation "public.item_notes" does not exist' }

function table() {
  const chain = {
    _ids: [] as string[],
    _eq: {} as Record<string, string>,
    select() {
      return this
    },
    order() {
      return this
    },
    limit(n: number) {
      // listMyNotes: RLS already scopes this to the caller, so the query is a
      // bare select of own rows — the cap is the only thing bounding it.
      return Promise.resolve(
        state.missingTable
          ? { data: null, error: ERR }
          : {
              data: state.rows
                .slice(0, n)
                .map((r) => ({ ...r, updated_at: '2026-07-29T12:00:00.000Z' })),
              error: null,
            },
      )
    },
    in(_col: string, ids: string[]) {
      this._ids = ids
      return Promise.resolve(
        state.missingTable
          ? { data: null, error: ERR }
          : {
              data: state.rows.filter((r) => ids.includes(r.item_id)),
              error: null,
            },
      )
    },
    upsert(row: { author_id: string; item_id: string; note: string }) {
      if (!state.missingTable && !state.writeFilteredOut) {
        const i = state.rows.findIndex(
          (r) => r.author_id === row.author_id && r.item_id === row.item_id,
        )
        if (i >= 0) state.rows[i] = row
        else state.rows.push(row)
      }
      return {
        select: () =>
          Promise.resolve(
            state.missingTable
              ? { data: null, error: ERR }
              : // RLS filtered it out: no error, and no row either
                { data: state.writeFilteredOut ? [] : [{ item_id: row.item_id }], error: null },
          ),
      }
    },
    delete() {
      return {
        eq(col: string, v: string) {
          chain._eq[col] = v
          if (col === 'item_id') {
            state.lastDelete = { author: chain._eq.author_id, item: v }
            if (!state.missingTable) {
              state.rows = state.rows.filter(
                (r) => !(r.author_id === chain._eq.author_id && r.item_id === v),
              )
            }
            return Promise.resolve({
              error: state.missingTable ? ERR : null,
            })
          }
          return this
        },
      }
    },
  }
  return chain
}

vi.mock('./client', () => ({
  getSupabase: () => Promise.resolve({ from: () => table() }),
}))

const { getItemNotes, saveItemNote, listMyNotes, NOTE_MAX, NOTES_PAGE } =
  await import('./notes')

beforeEach(() => {
  state.rows = []
  state.missingTable = false
  state.writeFilteredOut = false
  state.lastDelete = null
})

describe('saveItemNote', () => {
  it('saves a note and reads it back', async () => {
    expect(await saveItemNote('u1', 'l30-balance-off', 'c/d on the smaller side')).toBe(
      'saved',
    )
    const notes = await getItemNotes(['l30-balance-off'])
    expect(notes.get('l30-balance-off')).toBe('c/d on the smaller side')
  })

  it('overwrites rather than accumulating', async () => {
    await saveItemNote('u1', 'x', 'first')
    await saveItemNote('u1', 'x', 'second')
    expect(state.rows).toHaveLength(1)
    expect((await getItemNotes(['x'])).get('x')).toBe('second')
  })

  it('an empty note deletes the row instead of storing an empty string', async () => {
    // The CHECK constraint in 0008 refuses '' outright, so storing one is not
    // an option — but the point is that "cleared" and "never written" stay one
    // state the UI does not have to tell apart.
    await saveItemNote('u1', 'x', 'something')
    expect(await saveItemNote('u1', 'x', '   ')).toBe('cleared')
    expect(state.rows).toHaveLength(0)
    expect(state.lastDelete).toEqual({ author: 'u1', item: 'x' })
  })

  it('reports failure when the write is filtered out and no row comes back', async () => {
    // The regression this exists for: PostgREST returns 204 (not 403) when RLS
    // filters a write away. Trusting the absence of an error would show the
    // teacher "Saved" over a note that was never stored.
    state.writeFilteredOut = true
    expect(await saveItemNote('u1', 'x', 'note')).toBe('failed')
  })

  it('reports failure when 0008 has not been applied', async () => {
    state.missingTable = true
    expect(await saveItemNote('u1', 'x', 'note')).toBe('failed')
  })

  it('trims to the length the CHECK constraint allows', async () => {
    // Sending 2001 characters would be rejected wholesale by the constraint,
    // and the teacher would lose the note rather than the overflow.
    await saveItemNote('u1', 'x', 'a'.repeat(NOTE_MAX + 500))
    expect(state.rows[0].note).toHaveLength(NOTE_MAX)
  })
})

describe('getItemNotes', () => {
  it('returns only the items asked for', async () => {
    await saveItemNote('u1', 'a', 'note a')
    await saveItemNote('u1', 'b', 'note b')
    const notes = await getItemNotes(['a'])
    expect([...notes.keys()]).toEqual(['a'])
  })

  it('is a no-op on an empty id list — never a bare select of the table', async () => {
    await saveItemNote('u1', 'a', 'note a')
    expect((await getItemNotes([])).size).toBe(0)
  })

  it('degrades to no notes when 0008 is absent, rather than throwing', async () => {
    // A push deploys before Julius pastes the SQL. The rest of the learner
    // detail screen must still render.
    state.missingTable = true
    await expect(getItemNotes(['a'])).resolves.toEqual(new Map())
  })
})

describe('listMyNotes', () => {
  it('returns everything the teacher has written', async () => {
    await saveItemNote('u1', 'a', 'note a')
    await saveItemNote('u1', 'b', 'note b')
    const { notes, truncated } = await listMyNotes()
    expect(notes.map((n) => n.itemId)).toEqual(['a', 'b'])
    expect(notes[0].note).toBe('note a')
    expect(truncated).toBe(false)
  })

  it('reports when the cap bit, instead of quietly showing a slice', async () => {
    // The roster bug was exactly a truncation nobody was told about. A page
    // that silently shows 200 of 260 reads as "you have written 200".
    for (let i = 0; i < NOTES_PAGE + 5; i++) {
      await saveItemNote('u1', `item-${i}`, `note ${i}`)
    }
    const { notes, truncated } = await listMyNotes()
    expect(notes).toHaveLength(NOTES_PAGE)
    expect(truncated).toBe(true)
  })

  it('degrades to an empty list when 0008 is absent', async () => {
    state.missingTable = true
    await expect(listMyNotes()).resolves.toEqual({ notes: [], truncated: false })
  })
})
