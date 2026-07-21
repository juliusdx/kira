// Spaced-repetition scheduler — Leitner boxes (Build Spec §6).
// PURE module: no I/O, no clock of its own (caller passes `now`). Kept behind
// a small interface so FSRS can drop in later without touching the UI.

export interface ReviewState {
  box: number // 1..5
  dueAt: number // epoch ms
  streak: number // consecutive correct
  lastResult: boolean | null
  updatedAt: number
}

const DAY = 24 * 60 * 60 * 1000

/** Interval before an item in `box` becomes due again. Index = box - 1. */
export const BOX_INTERVALS_MS: readonly number[] = [
  0, // box 1 — same session
  1 * DAY, // box 2
  3 * DAY, // box 3
  7 * DAY, // box 4
  21 * DAY, // box 5
]

export const MAX_BOX = BOX_INTERVALS_MS.length // 5
export const MIN_BOX = 1

export function intervalForBox(box: number): number {
  const clamped = Math.min(Math.max(box, MIN_BOX), MAX_BOX)
  return BOX_INTERVALS_MS[clamped - 1]
}

/** Fresh state for an item the learner has never seen — due immediately. */
export function initialReview(now: number): ReviewState {
  return { box: MIN_BOX, dueAt: now, streak: 0, lastResult: null, updatedAt: now }
}

/**
 * Advance review state after an attempt.
 * Correct → box + 1 (cap 5), streak + 1.
 * Wrong   → back to box 1, streak reset. Wrong items resurface this session.
 */
export function schedule(
  prev: ReviewState | undefined,
  correct: boolean,
  now: number,
): ReviewState {
  const base = prev ?? initialReview(now)
  const box = correct ? Math.min(base.box + 1, MAX_BOX) : MIN_BOX
  const streak = correct ? base.streak + 1 : 0
  return {
    box,
    streak,
    lastResult: correct,
    dueAt: now + intervalForBox(box),
    updatedAt: now,
  }
}

export function isDue(state: ReviewState, now: number): boolean {
  return state.dueAt <= now
}

/** Mastery weight for one item: 0 (unseen) .. 1 (box 5). */
export function masteryWeight(state: ReviewState | undefined): number {
  if (!state) return 0
  return (state.box - 1) / (MAX_BOX - 1)
}
