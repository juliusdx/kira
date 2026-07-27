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

  it('a tap that completes the item submits it — no second trip to Check', async () => {
    const user = userEvent.setup()
    const onSubmit = renderItem()

    const check = screen.getByRole('button', { name: 'check' }) as HTMLButtonElement
    expect(check.disabled).toBe(true)

    const amount = screen.getByLabelText('Annual charge') as HTMLInputElement
    amount.focus()
    await user.keyboard('10000')
    // typing never auto-submits — there is no way to know a number is finished
    expect(onSubmit).not.toHaveBeenCalled()
    expect(check.disabled).toBe(true) // the choice is still blank

    await user.click(screen.getByRole('button', { name: 'Depreciation Expense' }))
    // the tap completed the item, so it went in on its own. Worked steps
    // (0 and 3) are never part of the response.
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      filled: { 1: 10000, 2: 'Depreciation Expense' },
    })
  })

  it('a tap that leaves another blank empty does NOT submit', async () => {
    const user = userEvent.setup()
    const onSubmit = renderItem()

    // the number blank is still empty, so this tap only records a choice
    await user.click(screen.getByRole('button', { name: 'Depreciation Expense' }))
    expect(onSubmit).not.toHaveBeenCalled()

    const check = screen.getByRole('button', { name: 'check' }) as HTMLButtonElement
    expect(check.disabled).toBe(true)
  })

  it('typing the last blank still requires Check', async () => {
    const user = userEvent.setup()
    const onSubmit = renderItem()

    await user.click(screen.getByRole('button', { name: 'Depreciation Expense' }))
    const amount = screen.getByLabelText('Annual charge') as HTMLInputElement
    amount.focus()
    await user.keyboard('10000')
    expect(onSubmit).not.toHaveBeenCalled()

    const check = screen.getByRole('button', { name: 'check' }) as HTMLButtonElement
    expect(check.disabled).toBe(false)
    await user.click(check)
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })

  it('re-tapping an already-complete item does not commit early', async () => {
    const user = userEvent.setup()
    const onSubmit = renderItem()

    // complete it by TYPING last, so nothing has been submitted yet ...
    await user.click(screen.getByRole('button', { name: 'Depreciation Expense' }))
    const amount = screen.getByLabelText('Annual charge') as HTMLInputElement
    amount.focus()
    await user.keyboard('10000')
    expect(onSubmit).not.toHaveBeenCalled()

    // ... then change your mind about the account. That must NOT fire.
    await user.click(screen.getByRole('button', { name: 'Cash' }))
    expect(onSubmit).not.toHaveBeenCalled()
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

  // Regression: the tap handlers used to read `filled` from the render closure,
  // so two taps landing in ONE React batch both saw the same empty map and the
  // second silently discarded the first. Real fast tapping hits this; userEvent
  // does not, because it awaits a re-render between events.
  it('two taps in a single batch accumulate instead of overwriting', () => {
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

    expect(onSubmit).toHaveBeenCalledTimes(1)
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
