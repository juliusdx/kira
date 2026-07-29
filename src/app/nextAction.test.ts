import { describe, it, expect } from 'vitest'
import { nextAction } from './nextAction'
import { UI, tr } from '../i18n/strings'

const NOW = Date.parse('2026-07-29T12:00:00.000Z')
const day = 86_400_000
const ago = (d: number) => new Date(NOW - d * day).toISOString()

const base = {
  attempts: 50,
  seen: 20,
  due: 0,
  accuracyPct: 85,
  lastActiveAt: ago(0),
}

describe('nextAction', () => {
  it('a learner who joined but never practised gets a CAUSE, not a task', () => {
    // In this project that is nearly always the identity bug: anonymous auth is
    // per device AND per origin, so "she is using it" and "this account has
    // attempts" are different claims.
    const a = nextAction({ ...base, attempts: 0, seen: 0, lastActiveAt: null }, NOW)
    expect(a.key).toBe('actNotStarted')
    expect(a.tone).toBe('attention')
  })

  it('going quiet outranks everything, including due reviews', () => {
    // Spaced repetition not returned to is just forgetting on a schedule.
    const a = nextAction({ ...base, due: 12, lastActiveAt: ago(9) }, NOW)
    expect(a).toEqual({ key: 'actIdle', n: 9, tone: 'urgent' })
  })

  it('due AND a couple of quiet days reads as slipping', () => {
    const a = nextAction({ ...base, due: 12, lastActiveAt: ago(3) }, NOW)
    expect(a).toEqual({ key: 'actDueStale', n: 12, tone: 'urgent' })
  })

  it('due today is a task, not an alarm', () => {
    const a = nextAction({ ...base, due: 4, lastActiveAt: ago(0) }, NOW)
    expect(a).toEqual({ key: 'actDue', n: 4, tone: 'attention' })
  })

  it('accuracy only becomes the action once nothing is due', () => {
    // With reviews outstanding the answer is "do the reviews" either way, so a
    // low score must not displace them.
    const withDue = nextAction({ ...base, due: 5, accuracyPct: 40 }, NOW)
    expect(withDue.key).toBe('actDue')

    const clear = nextAction({ ...base, due: 0, accuracyPct: 40 }, NOW)
    expect(clear).toEqual({ key: 'actStruggling', n: 40, tone: 'attention' })
  })

  it('ignores an accuracy figure drawn from too few attempts', () => {
    // 2 wrong out of 3 is not evidence of anything.
    const a = nextAction({ ...base, due: 0, attempts: 3, accuracyPct: 33 }, NOW)
    expect(a.key).toBe('actCaughtUp')
  })

  it('says so plainly when there is nothing to do', () => {
    expect(nextAction(base, NOW)).toEqual({ key: 'actCaughtUp', tone: 'ok' })
  })

  it('never returns a key without a bilingual string, or leaves {n} on screen', () => {
    const cases = [
      { ...base, attempts: 0, seen: 0, lastActiveAt: null },
      { ...base, due: 12, lastActiveAt: ago(9) },
      { ...base, due: 12, lastActiveAt: ago(3) },
      { ...base, due: 4 },
      { ...base, due: 0, accuracyPct: 40 },
      base,
    ]
    for (const c of cases) {
      const a = nextAction(c, NOW)
      expect(UI[a.key], a.key).toBeTruthy()
      for (const loc of ['en', 'ms'] as const) {
        const text = tr(a.key, loc).replace('{n}', String(a.n ?? ''))
        expect(text.trim(), `${a.key}/${loc}`).not.toBe('')
        expect(text, `${a.key}/${loc}`).not.toContain('{n}')
      }
    }
  })
})
