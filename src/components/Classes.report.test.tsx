import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { tr } from '../i18n/strings'
import type { UIKey } from '../i18n/strings'
import type { LearnerDetail } from '../sync/classes'

// The teacher's screens as a REPORT: it says when it was taken, it can be
// taken again, and — the part with teeth — taking it again happens when the
// teacher asks, not on every render.

const getLearnerDetail = vi.fn()
vi.mock('../sync/classes', async () => {
  const actual = await vi.importActual<typeof import('../sync/classes')>('../sync/classes')
  return { ...actual, getLearnerDetail: (...a: unknown[]) => getLearnerDetail(...a) }
})
vi.mock('../sync/notes', () => ({
  NOTE_MAX: 2000,
  getItemNotes: () => Promise.resolve(new Map()),
  saveItemNote: () => Promise.resolve('saved'),
}))
vi.mock('../sync/identity', () => ({
  getIdentity: () => Promise.resolve({ userId: 'teacher-1', email: null }),
}))

// Deliberately returns a NEW `t` on every call, exactly as the real context
// does. That instability is what turned the mount effect into an every-render
// effect, so a stable mock here would test nothing.
vi.mock('../app/KiraContext', () => ({
  useKira: () => ({ locale: 'en', t: (k: string) => k }),
}))

const { LearnerDetailView, freshness } = await import('./Classes')

const empty: LearnerDetail = {
  topics: [],
  overallPct: 0,
  seen: 0,
  attempts: 0,
  accuracyPct: null,
  weakest: [],
  recentMisses: [],
}

const learner = {
  userId: 'learner-1',
  displayName: 'Aina',
  avatar: null,
  joinedAt: new Date().toISOString(),
  lastActiveAt: new Date().toISOString(),
  seen: 0,
  mastered: 0,
  due: 0,
  masteryPct: 0,
  accuracyPct: null,
  attempts: 0,
}
const cls = { id: 'c1', name: 'Form 4', join_code: 'ABCDEFGHIJKL', created_at: '' }

beforeEach(() => {
  vi.clearAllMocks()
  getLearnerDetail.mockResolvedValue(empty)
})

describe('the report loads once', () => {
  it('does NOT refetch on every render', async () => {
    // The regression, and it was a live bug: useErrorText() closed over `t`,
    // `t` is new each render, so the fetch callback was new each render and
    // its effect re-ran — hammering the RPC and resetting screen state under
    // the teacher. Caught because the note test started failing for reasons
    // that had nothing to do with notes.
    render(<LearnerDetailView cls={cls} learner={learner} onBack={() => {}} />)
    await screen.findByText('recentMisses')

    const afterMount = getLearnerDetail.mock.calls.length
    expect(afterMount).toBe(1)

    // force several more renders
    const user = userEvent.setup()
    for (let i = 0; i < 3; i++) await user.click(screen.getByText('refresh'))
    await waitFor(() => expect(getLearnerDetail).toHaveBeenCalledTimes(afterMount + 3))

    // exactly the three the teacher asked for — no extras from re-rendering
    expect(getLearnerDetail).toHaveBeenCalledTimes(4)
  })

  it('refreshes when the teacher asks', async () => {
    const user = userEvent.setup()
    render(<LearnerDetailView cls={cls} learner={learner} onBack={() => {}} />)
    await screen.findByText('recentMisses')

    await user.click(screen.getByText('refresh'))
    await waitFor(() => expect(getLearnerDetail).toHaveBeenCalledTimes(2))
  })
})

describe('freshness', () => {
  const en = (k: UIKey) => tr(k, 'en')
  const ms = (k: UIKey) => tr(k, 'ms')
  const NOW = Date.parse('2026-07-29T12:00:00.000Z')

  it('says how old the report is, in both languages', () => {
    expect(freshness(NOW - 10_000, en, NOW)).toBe('as of just now')
    expect(freshness(NOW - 5 * 60_000, en, NOW)).toBe('as of 5 min ago')
    expect(freshness(NOW - 3 * 3600_000, en, NOW)).toBe('as of 3h ago')
    expect(freshness(NOW - 5 * 60_000, ms, NOW)).toBe('setakat 5 minit lalu')
  })

  it('says nothing at all before the first load', () => {
    // An empty string, not "as of never" — there is no report yet to date.
    expect(freshness(null, en, NOW)).toBe('')
  })

  it('never leaves a placeholder on screen', () => {
    for (const ago of [0, 60_000, 59 * 60_000, 26 * 3600_000]) {
      expect(freshness(NOW - ago, en, NOW)).not.toMatch(/\{[tn]\}/)
      expect(freshness(NOW - ago, ms, NOW)).not.toMatch(/\{[tn]\}/)
    }
  })
})
