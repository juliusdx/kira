import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NumericItem } from './NumericItem'
import { formatAmount } from './shared'
import { getItem } from '../../content/loader'
import type { NumericItem as NumericItemType } from '../../content/types'

// Ratio analysis is the first content that answers in something other than
// ringgit. A currency leads its figure and a ratio unit trails it, so these
// pin the real authored items rather than a fixture — a unit that silently
// flipped side would read "% 20" to a learner and pass every other test.

vi.mock('../../app/KiraContext', () => ({
  useKira: () => ({ locale: 'en', t: (k: string) => k }),
}))

function numeric(id: string): NumericItemType {
  const item = getItem(id)
  if (item?.type !== 'numeric') throw new Error(`${id} is not a numeric item`)
  return item
}

describe('formatAmount', () => {
  it('leads with a currency and trails with a ratio unit', () => {
    expect(formatAmount(1500)).toBe('RM 1,500')
    expect(formatAmount(20, '%', true)).toBe('20%')
    expect(formatAmount(8, 'times', true)).toBe('8 times')
    expect(formatAmount(30, 'hari', true)).toBe('30 hari')
  })
})

describe('a numeric item answered in something other than ringgit', () => {
  it('ra-001: shows the answer as a percentage, not as an amount', () => {
    const item = numeric('ra-001')
    expect(item.answer).toBe(20)
    render(
      <NumericItem
        item={item}
        locale="en"
        graded={true}
        lastResponse={99}
        onSubmit={vi.fn()}
      />,
    )
    // The revealed answer is the one place the unit is rendered as text.
    expect(screen.getByText('correctAnswer: 20%')).toBeTruthy()
  })

  it('ra-004: a word unit is shown in the reading locale', () => {
    const item = numeric('ra-004')
    const { unmount } = render(
      <NumericItem
        item={item}
        locale="en"
        graded={true}
        lastResponse={99}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByText('correctAnswer: 3 times')).toBeTruthy()
    unmount()

    render(
      <NumericItem
        item={item}
        locale="ms"
        graded={true}
        lastResponse={99}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByText('correctAnswer: 3 kali')).toBeTruthy()
  })

  it('a ringgit item is unchanged — the unit still leads', () => {
    const item = numeric('co-007')
    render(
      <NumericItem
        item={item}
        locale="ms"
        graded={true}
        lastResponse={0}
        onSubmit={vi.fn()}
      />,
    )
    expect(screen.getByText('correctAnswer: RM 12,000')).toBeTruthy()
  })
})
