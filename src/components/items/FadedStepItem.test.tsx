import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { FadedStepItem } from './FadedStepItem'
import type { FadedStepItem as FadedStepItemType } from '../../content/types'

// Avoid the Dexie-backed context in a pure component test.
vi.mock('../../app/KiraContext', () => ({
  useKira: () => ({ locale: 'en', t: (k: string) => k }),
}))

const item: FadedStepItemType = {
  id: 'f', type: 'faded_step', difficulty: 3, skill_tags: [],
  prompt: { en: '', ms: '' }, explanation: { en: '', ms: '' },
  data: {
    steps: [
      { kind: 'number', label: { en: 'Cost', ms: 'Kos' }, value: 60000 },
      { kind: 'number', label: { en: 'Annual charge', ms: 'Caj tahunan' }, value: 10000, blank: true },
      { kind: 'choice', label: { en: 'Account to debit', ms: 'Akaun untuk didebit' }, value: 'Depreciation Expense', value_ms: 'Belanja Susut Nilai', blank: true },
      { kind: 'choice', label: { en: 'Account to credit', ms: 'Akaun untuk dikredit' }, value: 'Accumulated Depreciation', value_ms: 'Susut Nilai Terkumpul' },
    ],
    distractors: [{ value: 'Cash', value_ms: 'Tunai' }],
  },
}

function renderItem(props: Partial<Parameters<typeof FadedStepItem>[0]> = {}) {
  const onSubmit = vi.fn()
  render(
    <FadedStepItem
      item={item}
      locale="en"
      graded={false}
      lastResponse={null}
      onSubmit={onSubmit}
      {...props}
    />,
  )
  return onSubmit
}

describe('FadedStepItem', () => {
  it('shows worked steps as answers and fades only the blanked ones', () => {
    renderItem()
    // worked: value is displayed, no input offered
    expect(screen.getByText('RM 60,000')).toBeTruthy()
    expect(screen.queryByLabelText('Cost')).toBeNull()
    // faded: an input / chips to fill
    expect(screen.getByLabelText('Annual charge')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Depreciation Expense' })).toBeTruthy()
  })

  it('offers every choice value plus distractors as options for a blank', () => {
    renderItem()
    for (const label of ['Depreciation Expense', 'Accumulated Depreciation', 'Cash'])
      expect(screen.getByRole('button', { name: label })).toBeTruthy()
  })

  it('cannot submit until every blank is filled, then reports only the blanks', async () => {
    const user = userEvent.setup()
    const onSubmit = renderItem()

    const check = screen.getByRole('button', { name: 'check' }) as HTMLButtonElement
    expect(check.disabled).toBe(true)

    const amount = screen.getByLabelText('Annual charge') as HTMLInputElement
    amount.focus()
    await user.keyboard('10000')
    expect(check.disabled).toBe(true) // the choice is still blank

    await user.click(screen.getByRole('button', { name: 'Depreciation Expense' }))
    expect(check.disabled).toBe(false)

    await user.click(check)
    // worked steps (0 and 3) are never part of the response
    expect(onSubmit).toHaveBeenCalledWith({
      filled: { 1: 10000, 2: 'Depreciation Expense' },
    })
  })

  it('when graded, reveals the answer for a blank the learner got wrong', () => {
    renderItem({
      graded: true,
      lastResponse: { filled: { 1: 12000, 2: 'Cash' } },
    })
    // both blanks were wrong, so both reveal their value
    expect(screen.getAllByText(/correctAnswer/).length).toBe(2)
    expect(screen.getByText('correctAnswer: RM 10,000')).toBeTruthy()
  })

  it('renders BM labels for choices when the locale is ms', () => {
    renderItem({ locale: 'ms' })
    expect(screen.getByRole('button', { name: 'Belanja Susut Nilai' })).toBeTruthy()
    // Appears twice: as the worked step's value, and as a chip — a value used
    // elsewhere in the item is exactly the distractor a learner might misplace.
    expect(screen.getAllByText('Susut Nilai Terkumpul').length).toBe(2)
  })
})
