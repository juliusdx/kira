import Dexie, { type Table } from 'dexie'
import type { ReviewState } from '../scheduler/scheduler'

// Local-first store (Build Spec §4). Every read/write hits IndexedDB via Dexie.
// A Supabase sync queue can be layered on later without changing these shapes;
// the columns mirror the planned `review_state` / `attempts` tables (§5).

export interface ReviewRow extends ReviewState {
  itemId: string
}

export interface AttemptRow {
  id?: number
  itemId: string
  correct: boolean
  chosen: unknown // what the learner answered (jsonb in §5)
  msTaken: number
  createdAt: number
}

export interface MetaRow {
  key: string
  value: unknown
}

class KiraDB extends Dexie {
  reviewState!: Table<ReviewRow, string>
  attempts!: Table<AttemptRow, number>
  meta!: Table<MetaRow, string>

  constructor() {
    super('kira')
    this.version(1).stores({
      reviewState: 'itemId, dueAt, box',
      attempts: '++id, itemId, createdAt',
      meta: 'key',
    })
  }
}

export const db = new KiraDB()
