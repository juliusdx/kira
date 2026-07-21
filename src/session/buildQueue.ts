import type { ItemIndexEntry } from '../content/types'
import { isDue, type ReviewState } from '../scheduler/scheduler'

export interface QueueConfig {
  maxNew: number // desirable difficulty: ≤4 new items / session (Spec §2)
  maxDue: number // keep sessions short (5–10 min)
}

export const DEFAULT_QUEUE_CONFIG: QueueConfig = { maxNew: 4, maxDue: 12 }

export interface BuiltQueue {
  queue: ItemIndexEntry[]
  newIds: Set<string> // items the learner is seeing for the first time
}

/**
 * Assemble a session:
 *   - all DUE items (reviewState exists and dueAt ≤ now), capped at maxDue
 *   - up to maxNew brand-new items, in content order
 * then interleave by type via round-robin so one interaction type is never
 * batched (interleaving aids discrimination — Spec §6).
 */
export function buildQueue(
  entries: ItemIndexEntry[],
  reviewState: Map<string, ReviewState>,
  now: number,
  config: QueueConfig = DEFAULT_QUEUE_CONFIG,
): BuiltQueue {
  const due: ItemIndexEntry[] = []
  const fresh: ItemIndexEntry[] = []

  for (const entry of entries) {
    const state = reviewState.get(entry.item.id)
    if (state) {
      if (isDue(state, now)) due.push(entry)
    } else {
      fresh.push(entry)
    }
  }

  due.sort((a, b) => {
    const da = reviewState.get(a.item.id)!.dueAt
    const db = reviewState.get(b.item.id)!.dueAt
    return da - db || a.order - b.order
  })
  fresh.sort((a, b) => a.order - b.order)

  const pickedDue = due.slice(0, config.maxDue)
  const pickedNew = fresh.slice(0, config.maxNew)
  const newIds = new Set(pickedNew.map((e) => e.item.id))

  // Priority pool: due first, then new (so spaced reviews surface early).
  const pool = [...pickedDue, ...pickedNew]
  return { queue: interleaveByType(pool), newIds }
}

/**
 * Round-robin across type buckets. Within a bucket, priority order (due before
 * new, then content order) is preserved. Guarantees no long single-type run
 * while any other type remains.
 */
export function interleaveByType(pool: ItemIndexEntry[]): ItemIndexEntry[] {
  const buckets = new Map<string, ItemIndexEntry[]>()
  const typeOrder: string[] = []
  for (const entry of pool) {
    const type = entry.item.type
    if (!buckets.has(type)) {
      buckets.set(type, [])
      typeOrder.push(type)
    }
    buckets.get(type)!.push(entry)
  }

  const out: ItemIndexEntry[] = []
  let remaining = pool.length
  let i = 0
  while (remaining > 0) {
    const type = typeOrder[i % typeOrder.length]
    const bucket = buckets.get(type)!
    if (bucket.length) {
      out.push(bucket.shift()!)
      remaining--
    }
    i++
  }
  return out
}
