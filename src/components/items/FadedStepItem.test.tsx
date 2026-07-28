import { describe, it, expect, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
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

  // A MULTI-blank item always waits for Check, so an earlier answer can still
  // be revised after the last one is given.
  it('a multi-blank item never auto-submits, even when a tap completes it', async () => {
    const user = userEvent.setup()
    const onSubmit = renderItem()

    const check = screen.getByRole('button', { name: 'check' }) as HTMLButtonElement
    expect(check.disabled).toBe(true)

    const amount = screen.getByLabelText('Annual charge') as HTMLInputElement
    amount.focus()
    await user.keyboard('10000')
    expect(onSubmit).not.toHaveBeenCalled()
    expect(check.disabled).toBe(true) // the choice is still blank

    // this tap completes the item — but it must still wait
    await user.click(screen.getByRole('button', { name: 'Depreciation Expense' }))
    expect(onSubmit).not.toHaveBeenCalled()
    expect(check.disabled).toBe(false)

    // ... and the learner can still change their mind first
    await user.click(screen.getByRole('button', { name: 'Cash' }))
    expect(onSubmit).not.toHaveBeenCalled()

    await user.click(check)
    // worked steps (0 and 3) are never part of the response
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ filled: { 1: 10000, 2: 'Cash' } })
  })

  // A SINGLE-blank choice is the whole answer in one tap, so it commits like a
  // classify item — the first rung of most ladders is exactly this shape.
  it('a single-blank choice submits on the tap, with no Check', async () => {
    const user = userEvent.setup()
    const oneBlank: FadedStepItemType = {
      ...item,
      data: {
        ...item.data,
        steps: [
          item.data.steps[0],
          { ...item.data.steps[1], blank: false },
          item.data.steps[2],
          { ...item.data.steps[3] },
        ],
      },
    }
    const onSubmit = vi.fn()
    render(
      <FadedStepItem
        item={oneBlank}
        locale="en"
        graded={false}
        lastResponse={null}
        onSubmit={onSubmit}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Depreciation Expense' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({ filled: { 2: 'Depreciation Expense' } })
  })

  it('a single-blank NUMBER still requires Check — typing is never a commitment', async () => {
    const user = userEvent.setup()
    const oneNumber: FadedStepItemType = {
      ...item,
      data: {
        ...item.data,
        steps: [
          item.data.steps[0],
          item.data.steps[1],
          { ...item.data.steps[2], blank: false },
          { ...item.data.steps[3] },
        ],
      },
    }
    const onSubmit = vi.fn()
    render(
      <FadedStepItem
        item={oneNumber}
        locale="en"
        graded={false}
        lastResponse={null}
        onSubmit={onSubmit}
      />,
    )

    const amount = screen.getByLabelText('Annual charge') as HTMLInputElement
    amount.focus()
    await user.keyboard('10000')
    expect(onSubmit).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'check' }))
    expect(onSubmit).toHaveBeenCalledWith({ filled: { 1: 10000 } })
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

  // Regression: a tap handler that reads its own state from the render closure
  // loses answers when two taps land in ONE React batch — both see the same map
  // and the second discards the first. userEvent cannot catch it (it awaits a
  // re-render between events) and nor can fireEvent; the clicks have to be
  // dispatched inside a single act().
  it('two taps in a single batch accumulate instead of overwriting', async () => {
    const twoChoices: FadedStepItemType = {
      ...item,
      data: {
        ...item.data,
        steps: [
          item.data.steps[0],
          { ...item.data.steps[2] },
          { ...item.data.steps[3], blank: true },
        ],
      },
    }
    const onSubmit = vi.fn()
    render(
      <FadedStepItem
        item={twoChoices}
        locale="en"
        graded={false}
        lastResponse={null}
        onSubmit={onSubmit}
      />,
    )

    // Each blank renders its own copy of the pool, so index by blank:
    // [0] belongs to the first blank, [1] to the second.
    const a = screen.getAllByRole('button', { name: 'Depreciation Expense' })[0]
    const b = screen.getAllByRole('button', { name: 'Accumulated Depreciation' })[1]
    // Dispatch both inside ONE act() so React batches them and neither handler
    // sees the other's render. fireEvent would flush between calls and hide it.
    act(() => {
      a.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      b.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    // Two blanks, so it waits for Check — and BOTH taps must have survived.
    expect(onSubmit).not.toHaveBeenCalled()
    await userEvent.setup().click(screen.getByRole('button', { name: 'check' }))
    expect(onSubmit).toHaveBeenCalledWith({
      filled: { 1: 'Depreciation Expense', 2: 'Accumulated Depreciation' },
    })
  })

  it('renders BM labels for choices when the locale is ms', () => {
    renderItem({ locale: 'ms' })
    expect(screen.getByRole('button', { name: 'Belanja Susut Nilai' })).toBeTruthy()
    // Appears twice: as the worked step's value, and as a chip — a value used
    // elsewhere in the item is exactly the distractor a learner might misplace.
    expect(screen.getAllByText('Susut Nilai Terkumpul').length).toBe(2)
  })
})
