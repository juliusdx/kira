import { describe, it, expect, vi, beforeEach } from 'vitest'

// Removing a learner from a class.
//
// The reason this has a test at all: PostgREST answers an RLS-filtered DELETE
// with 204 — the SAME response a successful delete gives. So "no error" is not
// evidence the learner is gone, and the client has to read the membership back.
// Without that, a refused removal tells the teacher it worked and the roster
// keeps serving the learner.

const state = {
  members: [] as { class_id: string; user_id: string }[],
  /** the delete is accepted and silently does nothing — the case that matters */
  filtered: false,
  /** the read-back itself fails */
  readError: null as { message: string } | null,
}

function from() {
  return {
    delete() {
      const eqs: Record<string, string> = {}
      const chain = {
        eq(col: string, v: string) {
          eqs[col] = v
          if (Object.keys(eqs).length === 2) {
            if (!state.filtered) {
              state.members = state.members.filter(
                (m) => !(m.class_id === eqs.class_id && m.user_id === eqs.user_id),
              )
            }
            // 204 either way: no error, no rows, no way to tell them apart.
            return Promise.resolve({ error: null })
          }
          return chain
        },
      }
      return chain
    },
    select() {
      const eqs: Record<string, string> = {}
      const chain = {
        eq(col: string, v: string) {
          eqs[col] = v
          if (Object.keys(eqs).length === 2) {
            return Promise.resolve({
              data: state.readError
                ? null
                : state.members.filter(
                    (m) => m.class_id === eqs.class_id && m.user_id === eqs.user_id,
                  ),
              error: state.readError,
            })
          }
          return chain
        },
      }
      return chain
    },
  }
}

vi.mock('./client', () => ({
  getSupabase: () =>
    Promise.resolve({
      from: () => from(),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'me' } } }) },
    }),
}))

const { removeMember, leaveClass } = await import('./classes')

beforeEach(() => {
  state.members = [{ class_id: 'c1', user_id: 'learner-1' }]
  state.filtered = false
  state.readError = null
})

describe('removeMember', () => {
  it('removes the learner and confirms they are gone', async () => {
    await expect(removeMember('c1', 'learner-1')).resolves.toBeUndefined()
    expect(state.members).toHaveLength(0)
  })

  it('THROWS when the delete was filtered away and the learner is still there', async () => {
    // The regression. Before the read-back this resolved successfully and the
    // teacher was told a learner had been removed who had not been.
    state.filtered = true
    await expect(removeMember('c1', 'learner-1')).rejects.toThrow(/still a member/)
    expect(state.members).toHaveLength(1)
  })

  it('treats an already-absent member as success', async () => {
    // The caller asked for "not in this class". They are not in this class.
    state.members = []
    await expect(removeMember('c1', 'learner-1')).resolves.toBeUndefined()
  })

  it('does not invent a failure when the verification itself fails', async () => {
    // A read-back that errors says nothing about whether the delete landed.
    // Reporting failure there would be as dishonest as reporting success.
    state.filtered = true
    state.readError = { message: 'network' }
    await expect(removeMember('c1', 'learner-1')).resolves.toBeUndefined()
  })
})

describe('leaveClass', () => {
  it('throws when the membership survives the delete', async () => {
    state.members = [{ class_id: 'c1', user_id: 'me' }]
    state.filtered = true
    await expect(leaveClass('c1')).rejects.toThrow(/still a member/)
  })

  it('resolves when the membership is gone', async () => {
    state.members = [{ class_id: 'c1', user_id: 'me' }]
    await expect(leaveClass('c1')).resolves.toBeUndefined()
    expect(state.members).toHaveLength(0)
  })
})
