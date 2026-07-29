import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { db } from '../db/db'
import { getMeta, setMeta } from '../db/data'
import { syncNow } from './sync'
import { ensureSession, getSupabase } from './client'
import { recordProbeUser } from './probeUsers'

// Exercises the real sync ORCHESTRATION — push, pull, merge, IndexedDB write —
// against a live Supabase project, using fake-indexeddb for Dexie.
//
// The unit tests cover merge logic with fixtures and merge.integration.test.ts
// covers the wire format; this covers the part in between that neither does:
// that syncNow() actually moves a learner's progress to the cloud and back.
//
// Skips automatically without credentials.

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
const configured = Boolean(url && key)

const ITEM = '__sync_probe__'
// Must be in the PAST: the incremental watermark is "now", so a future-dated
// row would look newer than every sync and re-push forever.
const T = Date.now() - 7 * 86_400_000

describe.skipIf(!configured)('syncNow — round trip against live Supabase', () => {
  beforeEach(async () => {
    await db.reviewState.clear()
    await db.attempts.clear()
    await setMeta('sync.lastSyncedAt', 0)
    await setMeta('sync.lastAttemptAt', 0)
  })

  afterAll(async () => {
    // remove the probe rows from the cloud
    const uid = await ensureSession()
    if (uid) recordProbeUser(uid, 'sync')
    const jwt = (await (await import('./client')).getSupabase()!)
    if (uid) {
      await jwt.from('review_state').delete().eq('item_id', ITEM)
      await jwt.from('attempts').delete().eq('item_id', ITEM)
    }
  })

  it('pushes local progress, then restores it onto a clean device', async () => {
    // --- device 1: a learner answers something -----------------------------
    await db.reviewState.put({
      itemId: ITEM,
      box: 4,
      dueAt: T + 7 * 86_400_000,
      streak: 3,
      lastResult: true,
      updatedAt: T,
    })
    await db.attempts.add({
      itemId: ITEM,
      correct: true,
      chosen: 'Asset',
      msTaken: 1234,
      createdAt: T,
    })

    const pushed = await syncNow()
    expect(pushed.ok, pushed.error).toBe(true)
    expect(pushed.skipped).toBeUndefined()
    expect(pushed.pushedReviews).toBe(1)
    expect(pushed.pushedAttempts).toBe(1)

    // --- device 2: same account, empty local store -------------------------
    await db.reviewState.clear()
    await setMeta('sync.lastSyncedAt', 0)
    expect(await db.reviewState.count()).toBe(0)

    const pulled = await syncNow()
    expect(pulled.ok, pulled.error).toBe(true)
    expect(pulled.pulledReviews).toBeGreaterThanOrEqual(1)

    const restored = await db.reviewState.get(ITEM)
    expect(restored).toBeDefined()
    expect(restored!.box).toBe(4)
    expect(restored!.streak).toBe(3)
    expect(restored!.lastResult).toBe(true)
    expect(restored!.dueAt).toBe(T + 7 * 86_400_000)
    expect(restored!.updatedAt).toBe(T)
  })

  it('does not clobber newer local progress with an older cloud row', async () => {
    // cloud holds the T-dated row from the previous test's push; local is newer
    await db.reviewState.put({
      itemId: ITEM,
      box: 5,
      dueAt: T + 21 * 86_400_000,
      streak: 9,
      lastResult: true,
      updatedAt: T + 60_000, // one minute newer
    })
    await setMeta('sync.lastSyncedAt', 0)

    const res = await syncNow()
    expect(res.ok, res.error).toBe(true)

    const local = await db.reviewState.get(ITEM)
    expect(local!.box, 'newer local answer must survive the pull').toBe(5)
    expect(local!.streak).toBe(9)
  })

  it('ADOPTS a different account instead of merging this device into it', async () => {
    const supabase = await getSupabase()!

    // --- learner A practises on this device, and it reaches the cloud ------
    await db.reviewState.put({
      itemId: ITEM,
      box: 5,
      dueAt: T,
      streak: 4,
      lastResult: true,
      updatedAt: T,
    })
    const first = await syncNow()
    expect(first.ok, first.error).toBe(true)
    const userA = (await supabase.auth.getUser()).data.user!.id

    // --- learner B signs in on the same device ----------------------------
    await supabase.auth.signOut()
    await supabase.auth.signInAnonymously()
    const userB = (await supabase.auth.getUser()).data.user!.id
    recordProbeUser(userB, 'sync-switched')
    expect(userB).not.toBe(userA)

    const second = await syncNow()
    expect(second.ok, second.error).toBe(true)
    expect(second.switchedAccount, 'must notice the account changed').toBe(true)

    // B starts clean — A's practice is NOT inherited
    expect(await db.reviewState.get(ITEM)).toBeUndefined()
    expect(await db.reviewState.count()).toBe(0)

    // ...and critically, A's row was never written into B's account
    const { data } = await supabase
      .from('review_state')
      .select('item_id')
      .eq('user_id', userB)
    expect(data ?? [], "B's cloud account must stay empty").toHaveLength(0)
  })

  it('records a lastSyncedAt watermark so the next run is incremental', async () => {
    await syncNow()
    const watermark = await getMeta<number>('sync.lastSyncedAt', 0)
    expect(watermark).toBeGreaterThan(0)

    // nothing new locally -> nothing to push
    const second = await syncNow()
    expect(second.ok).toBe(true)
    expect(second.pushedReviews ?? 0).toBe(0)
  })
})
