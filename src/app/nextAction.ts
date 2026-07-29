import type { UIKey } from '../i18n/strings'
import type { LearnerSummary } from '../sync/classes'

// What to DO about this learner, in one line.
//
// The roster is four numbers per learner — seen, mastered, due, accuracy — and
// every one of them describes a state. None of them tells a parent whether to
// do anything tonight, which is the only question they actually opened the app
// with. This picks the single most useful sentence and says it.
//
// Pure and unit-tested: the ordering below IS the editorial judgement, and it
// belongs somewhere it can be argued with, not buried in JSX.

export type ActionTone = 'urgent' | 'attention' | 'ok'

export interface NextAction {
  key: UIKey
  /** substituted into {n} */
  n?: number
  tone: ActionTone
}

/** Below this, an accuracy figure is noise rather than a signal. */
const MIN_ATTEMPTS_FOR_ACCURACY = 10
const STRUGGLING_PCT = 60
/** A Leitner interval of 1 day means two days quiet is already a slipped day. */
const STALE_DAYS = 2
const ABANDONED_DAYS = 7

export function nextAction(
  l: Pick<
    LearnerSummary,
    'attempts' | 'due' | 'accuracyPct' | 'lastActiveAt' | 'seen'
  >,
  now: number = Date.now(),
): NextAction {
  const idleDays = l.lastActiveAt
    ? Math.floor((now - Date.parse(l.lastActiveAt)) / 86_400_000)
    : null

  // Joined and never practised. Almost always the identity bug in this
  // project — anonymous auth is per device AND per origin — so this is the one
  // case where the line points at a cause rather than at a task.
  if (l.attempts === 0 || l.seen === 0) {
    return { key: 'actNotStarted', tone: 'attention' }
  }

  // Gone quiet outranks everything: spaced repetition that is not returned to
  // is not spaced repetition, it is forgetting on a schedule.
  if (idleDays !== null && idleDays >= ABANDONED_DAYS) {
    return { key: 'actIdle', n: idleDays, tone: 'urgent' }
  }

  if (l.due > 0 && idleDays !== null && idleDays >= STALE_DAYS) {
    return { key: 'actDueStale', n: l.due, tone: 'urgent' }
  }

  if (l.due > 0) {
    return { key: 'actDue', n: l.due, tone: 'attention' }
  }

  // Only once there is nothing to practise does accuracy become the action:
  // with reviews outstanding the answer is "do the reviews" either way.
  if (
    l.accuracyPct !== null &&
    l.attempts >= MIN_ATTEMPTS_FOR_ACCURACY &&
    l.accuracyPct < STRUGGLING_PCT
  ) {
    return { key: 'actStruggling', n: l.accuracyPct, tone: 'attention' }
  }

  return { key: 'actCaughtUp', tone: 'ok' }
}

/** Roster ordering: whoever needs something first. */
export const TONE_RANK: Record<ActionTone, number> = {
  urgent: 0,
  attention: 1,
  ok: 2,
}
