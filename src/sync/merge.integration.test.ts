import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { fromRemote, toRemote, type LocalReviewRow, type RemoteReviewRow } from './merge'
import { recordProbeUser } from './probeUsers'

// Integration test against a REAL Supabase project. Validates that the wire
// mapping in merge.ts matches the deployed schema — column names, types and
// timestamp handling — which unit tests with a hand-written fixture cannot
// catch.
//
// Skips automatically when credentials aren't configured, so CI without them
// (and anyone cloning the repo) still passes.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const configured = Boolean(url && key)

const ITEM_ID = '__integration_probe__'

let jwt = ''
let uid = ''

async function api(path: string, init: RequestInit = {}) {
  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: key!,
      Authorization: `Bearer ${jwt || key}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
}

describe.skipIf(!configured)('sync ⇄ live Supabase schema', () => {
  beforeAll(async () => {
    const res = await fetch(`${url}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: key!, 'Content-Type': 'application/json' },
      body: '{}',
    })
    const body = await res.json()
    jwt = body.access_token
    uid = body.user?.id
    if (uid) recordProbeUser(uid, 'merge')
    expect(jwt, 'anonymous sign-in must be enabled').toBeTruthy()
  })

  afterAll(async () => {
    if (jwt) await api(`/rest/v1/review_state?item_id=eq.${ITEM_ID}`, { method: 'DELETE' })
  })

  it('signs in anonymously and gets a real user id', () => {
    expect(uid).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('accepts a row produced by toRemote() and returns it unchanged', async () => {
    const local: LocalReviewRow = {
      itemId: ITEM_ID,
      box: 4,
      dueAt: Date.parse('2026-08-01T09:30:00.000Z'),
      streak: 7,
      lastResult: true,
      updatedAt: Date.parse('2026-07-21T08:15:00.000Z'),
    }

    const insert = await api('/rest/v1/review_state', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify(toRemote(local, uid)),
    })
    expect(insert.status, await insert.text().catch(() => '')).toBe(201)

    const res = await api(
      `/rest/v1/review_state?item_id=eq.${ITEM_ID}&select=item_id,box,due_at,streak,last_result,updated_at`,
    )
    const rows = (await res.json()) as RemoteReviewRow[]
    expect(rows).toHaveLength(1)

    // the round-trip must reproduce the original local row exactly
    expect(fromRemote(rows[0])).toEqual(local)
  })

  it('upsert is idempotent on (user_id, item_id)', async () => {
    const local: LocalReviewRow = {
      itemId: ITEM_ID,
      box: 5,
      dueAt: Date.parse('2026-09-01T00:00:00.000Z'),
      streak: 9,
      lastResult: false,
      updatedAt: Date.parse('2026-07-21T10:00:00.000Z'),
    }
    for (let i = 0; i < 2; i++) {
      const res = await api('/rest/v1/review_state', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify(toRemote(local, uid)),
      })
      // PostgREST answers 201 when it inserts and 200 when the upsert takes
      // the update path — both mean "accepted".
      expect([200, 201]).toContain(res.status)
    }
    const res = await api(`/rest/v1/review_state?item_id=eq.${ITEM_ID}&select=box,streak`)
    const rows = await res.json()
    expect(rows).toHaveLength(1) // upserted, not duplicated
    expect(rows[0].box).toBe(5) // and updated in place
  })

  it('RLS hides the row from a different anonymous user', async () => {
    const other = await fetch(`${url}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: key!, 'Content-Type': 'application/json' },
      body: '{}',
    }).then((r) => r.json())
    if (other.user?.id) recordProbeUser(other.user.id, 'merge-other')

    const res = await fetch(`${url}/rest/v1/review_state?select=item_id`, {
      headers: { apikey: key!, Authorization: `Bearer ${other.access_token}` },
    })
    expect(await res.json()).toEqual([])
  })
})
