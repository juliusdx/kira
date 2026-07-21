import { db } from '../db/db'
import { getMeta, setMeta } from '../db/data'
import type { SupabaseClient } from '@supabase/supabase-js'
import { ensureSession, getSupabase, SYNC_ENABLED } from './client'
import {
  fromRemote,
  mergeReviewRows,
  rowsToPush,
  toRemote,
  type LocalReviewRow,
  type RemoteReviewRow,
} from './merge'

// Local-first sync (Build Spec §4). Local is always the source of truth for
// the running session; this just reconciles in the background.
//
// No outbox table is needed: review_state rows carry `updatedAt` and attempts
// are append-only with `createdAt`, so "everything newer than the last sync"
// is a complete and replay-safe description of what to push. The unique index
// on (user_id, item_id, created_at) makes a retried attempt insert idempotent.

const LAST_SYNC_KEY = 'sync.lastSyncedAt'
const LAST_ATTEMPT_KEY = 'sync.lastAttemptAt'

export interface SyncResult {
  ok: boolean
  skipped?: 'disabled' | 'offline' | 'no-session' | 'in-flight'
  pushedReviews?: number
  pushedAttempts?: number
  pulledReviews?: number
  error?: string
}

let inFlight = false

export async function syncNow(): Promise<SyncResult> {
  const pending = getSupabase()
  if (!SYNC_ENABLED || !pending) return { ok: true, skipped: 'disabled' }
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return { ok: true, skipped: 'offline' }
  if (inFlight) return { ok: true, skipped: 'in-flight' }

  inFlight = true
  try {
    const supabase = await pending
    const userId = await ensureSession()
    if (!userId) return { ok: false, skipped: 'no-session' }

    const lastSyncedAt = await getMeta<number>(LAST_SYNC_KEY, 0)
    const lastAttemptAt = await getMeta<number>(LAST_ATTEMPT_KEY, 0)
    const startedAt = Date.now()

    const pushedReviews = await pushReviews(supabase, userId, lastSyncedAt)
    const pushedAttempts = await pushAttempts(supabase, userId, lastAttemptAt)
    const pulledReviews = await pullReviews(supabase, lastSyncedAt)

    await setMeta(LAST_SYNC_KEY, startedAt)
    await setMeta(LAST_ATTEMPT_KEY, startedAt)

    return { ok: true, pushedReviews, pushedAttempts, pulledReviews }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.warn('[kira] sync failed', message)
    return { ok: false, error: message }
  } finally {
    inFlight = false
  }
}

async function pushReviews(
  supabase: SupabaseClient,
  userId: string,
  since: number,
): Promise<number> {
  const all = (await db.reviewState.toArray()) as LocalReviewRow[]
  const pending = rowsToPush(all, since)
  if (!pending.length) return 0

  const { error } = await supabase
    .from('review_state')
    .upsert(
      pending.map((r) => toRemote(r, userId)),
      { onConflict: 'user_id,item_id' },
    )
  if (error) throw new Error(`push review_state: ${error.message}`)
  return pending.length
}

async function pushAttempts(
  supabase: SupabaseClient,
  userId: string,
  since: number,
): Promise<number> {
  const pending = await db.attempts.where('createdAt').above(since).toArray()
  if (!pending.length) return 0

  const { error } = await supabase.from('attempts').upsert(
    pending.map((a) => ({
      user_id: userId,
      item_id: a.itemId,
      correct: a.correct,
      chosen: a.chosen ?? null,
      ms_taken: a.msTaken,
      created_at: new Date(a.createdAt).toISOString(),
    })),
    { onConflict: 'user_id,item_id,created_at', ignoreDuplicates: true },
  )
  if (error) throw new Error(`push attempts: ${error.message}`)
  return pending.length
}

async function pullReviews(
  supabase: SupabaseClient,
  since: number,
): Promise<number> {
  // RLS already scopes this to the signed-in user.
  const { data, error } = await supabase
    .from('review_state')
    .select('item_id, box, due_at, streak, last_result, updated_at')
    .gt('updated_at', new Date(since).toISOString())
  if (error) throw new Error(`pull review_state: ${error.message}`)
  if (!data?.length) return 0

  const incoming = (data as RemoteReviewRow[]).map(fromRemote)
  const localRows = (await db.reviewState.toArray()) as LocalReviewRow[]
  const localMap = new Map(localRows.map((r) => [r.itemId, r]))

  const changed = mergeReviewRows(localMap, incoming)
  if (changed.length) await db.reviewState.bulkPut(changed)
  return changed.length
}

/**
 * Fire-and-forget background sync. Safe to call on app start, after a session,
 * and whenever the device comes back online.
 */
export function syncInBackground(): void {
  if (!SYNC_ENABLED) return
  void syncNow()
}

/** Re-sync when connectivity returns. Returns a cleanup function. */
export function watchConnectivity(): () => void {
  if (!SYNC_ENABLED || typeof window === 'undefined') return () => {}
  const onOnline = () => syncInBackground()
  window.addEventListener('online', onOnline)
  return () => window.removeEventListener('online', onOnline)
}
