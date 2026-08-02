import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ItemPreview } from './ItemPreview'
import { ALL_ITEMS, getItem } from '../content/loader'
import type { Item, ItemType } from '../content/types'

// The teacher-side read-only view of a question. Two things matter: it shows
// the ANSWER (a teacher is going over a miss, not sitting the test), and it is
// inert — a gradeable widget here would let a teacher record attempts against
// their own account while reviewing someone else's.

vi.mock('../app/KiraContext', () => ({
  useKira: () => ({ locale: 'en', t: (k: string) => k }),
}))

const item = (id: string): Item => {
  const it = getItem(id)
  if (!it) throw new Error(`${id} not in the bank`)
  return it
}

describe('ItemPreview', () => {
  it('renders every item type in the bank without throwing', () => {
    // One real item per type, so a new interaction type cannot ship with a
    // teacher view that crashes on it.
    const seen = new Map<ItemType, Item>()
    for (const i of ALL_ITEMS) if (!seen.has(i.type)) seen.set(i.type, i)
    expect(seen.size).toBe(8)

    for (const [type, it] of seen) {
      const { unmount } = render(<ItemPreview item={it} locale="en" />)
      expect(screen.getByText(it.prompt.en), `${type} (${it.id}) prompt`).toBeTruthy()
      unmount()
    }
  })

  it('is inert — no inputs and no gradeable controls', () => {
    for (const id of ['clf-001', 'ta-008', 'ra-001', 'fd-1003', 'je-001']) {
      const { unmount } = render(<ItemPreview item={item(id)} locale="en" />)
      expect(screen.queryAllByRole('textbox'), `${id} has an input`).toHaveLength(0)
      expect(screen.queryAllByRole('button'), `${id} has a button`).toHaveLength(0)
      unmount()
    }
  })

  it('marks the correct option on a choice item and still shows the others', () => {
    const it = item('dc-006') // answer: Credit
    render(<ItemPreview item={it} locale="en" />)
    expect(screen.getByText('✓ Credit')).toBeTruthy()
    expect(screen.getByText('Debit')).toBeTruthy() // the distractor is still visible
  })

  it('shows a T-account entry-by-entry with the closing balance and its side', () => {
    render(<ItemPreview item={item('ta-008')} locale="en" />)
    expect(screen.getByText('Sold goods on credit')).toBeTruthy()
    // ta-008 closes 500 on the CREDIT side — the whole point of the item
    expect(screen.getByText('RM 500 · credit')).toBeTruthy()
  })

  it('shows a numeric answer with its unit on the correct side', () => {
    render(<ItemPreview item={item('ra-001')} locale="en" />)
    expect(screen.getByText('20%')).toBeTruthy()
  })

  it('marks which steps of a faded ladder were actually asked', () => {
    // fd-1001 blanks only the last two of six steps
    render(<ItemPreview item={item('fd-1001')} locale="en" />)
    expect(screen.getByText(/Side the balance b\/d comes down on previewAsked/)).toBeTruthy()
    // a worked step is shown without the marker
    expect(screen.getByText('Total of the debit side')).toBeTruthy()
  })

  it('reads in BM when the teacher is reading in BM', () => {
    render(<ItemPreview item={item('ta-008')} locale="ms" />)
    expect(screen.getByText(item('ta-008').prompt.ms)).toBeTruthy()
    expect(screen.getByText('Akaun Belum Terima')).toBeTruthy()
  })
})
