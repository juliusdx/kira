import type { ReviewState } from '../scheduler/scheduler'

// Conflict resolution for local ⇄ cloud sync (Build Spec §4: local-first,
// last-write-wins for the MVP). Pure — no I/O, no clock of its own.

/** Wire shape of a `review_state` row (snake_case, ISO timestamps). */
export interface RemoteReviewRow {
  item_id: string
  box: number
  due_at: string
  streak: number
  last_result: boolean | null
  updated_at: string
}

export interface LocalReviewRow extends ReviewState {
  itemId: string
}

export function toRemote(row: LocalReviewRow, userId: string) {
  return {
    user_id: userId,
    item_id: row.itemId,
    box: row.box,
    due_at: new Date(row.dueAt).toISOString(),
    streak: row.streak,
    last_result: row.lastResult,
    updated_at: new Date(row.updatedAt).toISOString(),
  }
}

export function fromRemote(row: RemoteReviewRow): LocalReviewRow {
  return {
    itemId: row.item_id,
    box: row.box,
    dueAt: Date.parse(row.due_at),
    streak: row.streak,
    lastResult: row.last_result,
    updatedAt: Date.parse(row.updated_at),
  }
}

/**
 * Last-write-wins on `updatedAt`. Ties resolve to LOCAL — the device that is
 * being used should never see its own just-recorded answer flicker back.
 */
export function pickWinner(
  local: LocalReviewRow | undefined,
  remote: LocalReviewRow | undefined,
): LocalReviewRow | undefined {
  if (!local) return remote
  if (!remote) return local
  return remote.updatedAt > local.updatedAt ? remote : local
}

/**
 * Merge a batch of remote rows into the local map.
 * Returns only the rows that actually changed, so the caller writes the
 * minimum to IndexedDB.
 */
export function mergeReviewRows(
  local: Map<string, LocalReviewRow>,
  remote: LocalReviewRow[],
): LocalReviewRow[] {
  const changed: LocalReviewRow[] = []
  for (const incoming of remote) {
    const current = local.get(incoming.itemId)
    const winner = pickWinner(current, incoming)
    if (winner && winner !== current) changed.push(winner)
  }
  return changed
}

/** Rows the local device should push: newer locally than the last sync. */
export function rowsToPush(
  local: LocalReviewRow[],
  lastSyncedAt: number,
): LocalReviewRow[] {
  return local.filter((r) => r.updatedAt > lastSyncedAt)
}
