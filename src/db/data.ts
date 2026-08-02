import { db, type ExamRunRow, type ReviewRow } from './db'
import type { Item, Locale } from '../content/types'
import { schedule, type ReviewState } from '../scheduler/scheduler'

// --- review state ----------------------------------------------------------
export async function loadReviewMap(): Promise<Map<string, ReviewState>> {
  const rows = await db.reviewState.toArray()
  const map = new Map<string, ReviewState>()
  for (const { itemId, ...state } of rows) map.set(itemId, state)
  return map
}

/** Flat attempt history — the raw material for derived badges. */
export async function loadAttempts(): Promise<
  { itemId: string; correct: boolean; createdAt: number }[]
> {
  const rows = await db.attempts.toArray()
  return rows.map((r) => ({
    itemId: r.itemId,
    correct: r.correct,
    createdAt: r.createdAt,
  }))
}

/**
 * Record one attempt: advance the item's Leitner state, persist the attempt,
 * and return the new review state (so the in-memory session mirror can update).
 */
export async function recordAttempt(
  item: Item,
  correct: boolean,
  chosen: unknown,
  msTaken: number,
  now: number,
): Promise<ReviewState> {
  const existing = await db.reviewState.get(item.id)
  const prev: ReviewState | undefined = existing
    ? stripId(existing)
    : undefined
  const next = schedule(prev, correct, now)

  await db.transaction('rw', db.reviewState, db.attempts, async () => {
    await db.reviewState.put({ itemId: item.id, ...next })
    await db.attempts.add({
      itemId: item.id,
      correct,
      chosen,
      msTaken,
      createdAt: now,
    })
  })
  return next
}

function stripId(row: ReviewRow): ReviewState {
  const { itemId: _itemId, ...state } = row
  return state
}

// --- mock exam runs --------------------------------------------------------

/**
 * Save a finished paper and fold every answer into the learner's schedule.
 *
 * The answers are recorded as ordinary attempts on purpose. A mock is
 * retrieval practice under the hardest conditions the learner will ever meet,
 * so what it reveals about an item is at least as good as what a practice
 * session reveals — pretending it did not happen would leave the scheduler
 * believing something the learner has just disproved. It also means the mock
 * shows up in the teacher's roster and accuracy for free, with no new table.
 *
 * Blanks are NOT recorded. An unanswered question is a fact about the clock,
 * not about whether the learner knows the item, and dropping an item to box 1
 * because time ran out would punish them for the wrong thing.
 */
export async function saveExamRun(
  run: Omit<ExamRunRow, 'id'>,
  graded: { item: Item; correct: boolean; chosen: string | null; msTaken: number }[],
): Promise<number> {
  const id = await db.examRuns.add(run as ExamRunRow)
  for (const g of graded) {
    if (g.chosen === null) continue
    await recordAttempt(g.item, g.correct, g.chosen, g.msTaken, run.finishedAt)
  }
  return id
}

/** Past papers, newest first. Bounded by `limit` — a learner can sit many. */
export async function listExamRuns(limit = 10): Promise<ExamRunRow[]> {
  return db.examRuns.orderBy('finishedAt').reverse().limit(limit).toArray()
}

// --- meta (locale, streak) -------------------------------------------------
export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return row ? (row.value as T) : fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export async function getLocale(): Promise<Locale> {
  return getMeta<Locale>('locale', 'ms') // BM default (Spec §5)
}

export async function setLocale(locale: Locale): Promise<void> {
  await setMeta('locale', locale)
}

// --- streak ----------------------------------------------------------------
export interface StreakInfo {
  count: number
  lastDate: string | null // YYYY-MM-DD (local)
}

export function dayKey(now: number): string {
  const d = new Date(now)
  const y = d.getFullYear()
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${day}`
}

function prevDayKey(today: string): string {
  const [y, m, d] = today.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  return dayKey(dt.getTime())
}

/** Call once when a session is completed. Returns the updated streak. */
export async function bumpStreak(now: number): Promise<StreakInfo> {
  const info = await getMeta<StreakInfo>('streak', { count: 0, lastDate: null })
  const today = dayKey(now)
  if (info.lastDate === today) return info // already counted today
  const next: StreakInfo =
    info.lastDate === prevDayKey(today)
      ? { count: info.count + 1, lastDate: today }
      : { count: 1, lastDate: today }
  await setMeta('streak', next)
  return next
}

export async function getStreak(now: number): Promise<number> {
  const info = await getMeta<StreakInfo>('streak', { count: 0, lastDate: null })
  if (info.lastDate === null) return 0
  const today = dayKey(now)
  // streak stays "alive" only if the last active day was today or yesterday
  if (info.lastDate === today || info.lastDate === prevDayKey(today))
    return info.count
  return 0
}

// --- reset (settings / testing) -------------------------------------------
export async function resetAllProgress(): Promise<void> {
  await db.transaction('rw', db.reviewState, db.attempts, db.examRuns, db.meta, async () => {
    await db.reviewState.clear()
    await db.attempts.clear()
    await db.examRuns.clear()
    // keep locale, drop streak
    await db.meta.delete('streak')
  })
}
