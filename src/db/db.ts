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

/**
 * One sitting of a mock paper.
 *
 * LOCAL ONLY, for now. The individual answers already sync as `attempts`, so a
 * teacher still sees the effect of a mock on accuracy and on the schedule —
 * what does not travel is the paper as an event ("she scored 26/40 on Tuesday").
 * Storing that in the cloud means another table and another migration, and it
 * is worth doing only once a mock has been sat at least once.
 *
 * The questions are NOT stored: `seed` rebuilds them, because buildPaper is
 * deterministic. Storing both would let them disagree.
 */
export interface ExamRunRow {
  id?: number
  seed: number
  startedAt: number
  finishedAt: number
  /** one entry per question, in paper order; null means left blank */
  answers: (string | null)[]
  score: number
  total: number
  /** true when the clock ran out rather than the learner submitting */
  autoSubmitted: boolean
}

class KiraDB extends Dexie {
  reviewState!: Table<ReviewRow, string>
  attempts!: Table<AttemptRow, number>
  meta!: Table<MetaRow, string>
  examRuns!: Table<ExamRunRow, number>

  constructor() {
    super('kira')
    this.version(1).stores({
      reviewState: 'itemId, dueAt, box',
      attempts: '++id, itemId, createdAt',
      meta: 'key',
    })
    // Dexie carries unlisted stores forward, so only the new one is declared.
    this.version(2).stores({
      examRuns: '++id, finishedAt',
    })
  }
}

export const db = new KiraDB()
