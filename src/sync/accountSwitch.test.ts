import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/db'
import { getMeta, setMeta } from '../db/data'
import { clearLocalForAccountSwitch } from './sync'

// Signing in must ADOPT the account's progress, not merge this device's into
// it — otherwise a shared classroom tablet folds one learner's practice into
// the next learner's account.

const T = Date.now() - 86_400_000

async function seedDevice() {
  await db.reviewState.put({
    itemId: 'ap-001',
    box: 4,
    dueAt: T,
    streak: 3,
    lastResult: true,
    updatedAt: T,
  })
  await db.attempts.add({
    itemId: 'ap-001',
    correct: true,
    chosen: null,
    msTaken: 900,
    createdAt: T,
  })
  await setMeta('streak', { count: 7, lastDate: '2026-07-26' })
  await setMeta('locale', 'en')
  await setMeta('sync.lastSyncedAt', T)
  await setMeta('sync.lastAttemptAt', T)
}

describe('clearLocalForAccountSwitch', () => {
  beforeEach(async () => {
    await db.reviewState.clear()
    await db.attempts.clear()
    await db.meta.clear()
  })

  it("drops the previous learner's practice", async () => {
    await seedDevice()
    expect(await db.reviewState.count()).toBe(1)

    await clearLocalForAccountSwitch()

    expect(await db.reviewState.count()).toBe(0)
    expect(await db.attempts.count()).toBe(0)
  })

  it("drops the previous learner's streak", async () => {
    await seedDevice()
    await clearLocalForAccountSwitch()
    // a streak belongs to a person, not a device
    expect(await getMeta('streak', null)).toBeNull()
  })

  it('rewinds the sync watermarks so the next pull fetches EVERYTHING', async () => {
    await seedDevice()
    await clearLocalForAccountSwitch()

    // leaving these set would pull only rows newer than the last sync and
    // silently restore a partial history
    expect(await getMeta('sync.lastSyncedAt', -1)).toBe(0)
    expect(await getMeta('sync.lastAttemptAt', -1)).toBe(0)
  })

  it('keeps the chosen language — that is a device preference, not progress', async () => {
    await seedDevice()
    await clearLocalForAccountSwitch()
    expect(await getMeta('locale', null)).toBe('en')
  })

  it('is safe to run on an empty device', async () => {
    await expect(clearLocalForAccountSwitch()).resolves.toBeUndefined()
    expect(await db.reviewState.count()).toBe(0)
  })
})
