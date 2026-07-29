import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LearnerDetail, RecentMiss } from '../sync/classes'
import { getItem } from '../content/loader'
import type { Item } from '../content/types'

// The teacher's saved note, through the real LearnerDetailView (migration
// 0008). The interesting behaviour is not "text appears in a box" — it is that
// the status line never claims a save the server did not confirm, which is the
// same rule the clipboard broke once already.

const MISS_ITEM = 'dc-006'

const saveItemNote = vi.fn()
const getItemNotes = vi.fn()

vi.mock('../sync/notes', async () => {
  const actual = await vi.importActual<typeof import('../sync/notes')>('../sync/notes')
  return {
    NOTE_MAX: actual.NOTE_MAX,
    getItemNotes: (...a: unknown[]) => getItemNotes(...a),
    saveItemNote: (...a: unknown[]) => saveItemNote(...a),
  }
})

const getLearnerDetail = vi.fn()
vi.mock('../sync/classes', async () => {
  const actual = await vi.importActual<typeof import('../sync/classes')>('../sync/classes')
  return { ...actual, getLearnerDetail: (...a: unknown[]) => getLearnerDetail(...a) }
})

vi.mock('../sync/identity', () => ({
  getIdentity: () => Promise.resolve({ userId: 'teacher-1', email: null }),
}))

vi.mock('../app/KiraContext', () => ({
  useKira: () => ({ locale: 'en', t: (k: string) => k }),
}))

function detail(): LearnerDetail {
  const miss: RecentMiss = {
    itemId: MISS_ITEM,
    prompt: { en: 'Balance this account', ms: 'Imbangkan akaun ini' },
    topicTitle: { en: 'Ledger', ms: 'Lejar' },
    wrong: 3,
    lastWrongAt: new Date().toISOString(),
    item: getItem(MISS_ITEM) as Item,
    lessonTitle: { en: 'Balancing off', ms: 'Mengimbangkan' },
    siblings: 4,
    chosen: undefined,
  }
  return {
    topics: [],
    overallPct: 0,
    seen: 1,
    attempts: 3,
    accuracyPct: 0,
    weakest: [],
    recentMisses: [miss],
  }
}

const learner = {
  userId: 'learner-1',
  displayName: 'Aina',
  avatar: null,
  joinedAt: new Date().toISOString(),
  lastActiveAt: new Date().toISOString(),
  seen: 1,
  mastered: 0,
  due: 0,
  masteryPct: 0,
  accuracyPct: 0,
  attempts: 3,
}
const cls = { id: 'c1', name: 'Form 4', join_code: 'ABCDEFGHIJKL', created_at: '' }

const { LearnerDetailView } = await import('./Classes')

async function openTheMiss() {
  const user = userEvent.setup()
  render(<LearnerDetailView cls={cls} learner={learner} onBack={() => {}} />)
  await screen.findByText('Balance this account')
  await user.click(screen.getByText('Balance this account'))
  return user
}

beforeEach(() => {
  vi.clearAllMocks()
  getLearnerDetail.mockResolvedValue(detail())
  getItemNotes.mockResolvedValue(new Map())
  saveItemNote.mockResolvedValue('saved')
})

describe('the teacher note', () => {
  it('loads an existing note for the misses on screen', async () => {
    getItemNotes.mockResolvedValue(new Map([[MISS_ITEM, 'c/d on the smaller side']]))
    await openTheMiss()

    const box = await screen.findByLabelText('betterExplanation')
    expect(box).toHaveValue('c/d on the smaller side')
    // bounded by what is on screen, never the whole bank
    expect(getItemNotes).toHaveBeenCalledWith([MISS_ITEM])
  })

  it('saves on blur and says so only once the server confirms', async () => {
    const user = await openTheMiss()
    const box = await screen.findByLabelText('betterExplanation')

    await user.type(box, 'Put it on the smaller side.')
    // still only typed — nothing has been written yet
    expect(saveItemNote).not.toHaveBeenCalled()
    expect(screen.getByRole('status')).toHaveTextContent('noteUnsaved')

    await user.tab()
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('noteSaved'))
    expect(saveItemNote).toHaveBeenCalledWith(
      'teacher-1',
      MISS_ITEM,
      'Put it on the smaller side.',
    )
  })

  it('does NOT say saved when the write failed', async () => {
    // The whole point. A failed write leaves the text on screen and tells the
    // teacher to copy it out — the old behaviour, now only in the case where
    // it is true (0008 not applied, or the row filtered away).
    saveItemNote.mockResolvedValue('failed')
    const user = await openTheMiss()
    const box = await screen.findByLabelText('betterExplanation')

    await user.type(box, 'This will not land.')
    await user.tab()

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('noteSaveFailed'),
    )
    expect(screen.getByRole('status')).not.toHaveTextContent('noteSaved')
    expect(box).toHaveValue('This will not land.')
  })

  it('does not write when the text has not changed', async () => {
    // Reopening a miss to re-read a note must not touch the row or bump its
    // timestamp.
    getItemNotes.mockResolvedValue(new Map([[MISS_ITEM, 'unchanged']]))
    const user = await openTheMiss()
    const box = await screen.findByLabelText('betterExplanation')

    await user.click(box)
    await user.tab()
    expect(saveItemNote).not.toHaveBeenCalled()
  })

  it('clearing the box is a save, not a no-op', async () => {
    getItemNotes.mockResolvedValue(new Map([[MISS_ITEM, 'delete me']]))
    saveItemNote.mockResolvedValue('cleared')
    const user = await openTheMiss()
    const box = await screen.findByLabelText('betterExplanation')

    await user.clear(box)
    await user.tab()
    await waitFor(() =>
      expect(saveItemNote).toHaveBeenCalledWith('teacher-1', MISS_ITEM, ''),
    )
  })
})
