import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TAccountItem } from './TAccountItem'
import { FadedStepItem } from './FadedStepItem'
import { getItem } from '../../content/loader'
import { grade } from '../../grading/grade'
import type {
  FadedStepItem as FadedStepItemType,
  TAccountItem as TAccountItemType,
} from '../../content/types'

// The content guard round-trips grade() against every item's own answer, but it
// never touches the UI. These drive the REAL authored items of the balancing-off
// lessons through the real renderers, so what a learner can physically enter is
// what grade() accepts — the two closing-balance cases that break the guess
// "receivables are debit, payables are credit" are the ones worth pinning.

vi.mock('../../app/KiraContext', () => ({
  useKira: () => ({ locale: 'en', t: (k: string) => k }),
}))

function tAccount(id: string): TAccountItemType {
  const item = getItem(id)
  if (item?.type !== 't_account') throw new Error(`${id} is not a t_account`)
  return item
}

function faded(id: string): FadedStepItemType {
  const item = getItem(id)
  if (item?.type !== 'faded_step') throw new Error(`${id} is not a faded_step`)
  return item
}

describe('balancing off — a T-account that closes on the unexpected side', () => {
  it('ta-008: Trade Receivables closing on the CREDIT side grades correct', async () => {
    const user = userEvent.setup()
    const item = tAccount('ta-008')
    const onSubmit = vi.fn()
    render(
      <TAccountItem
        item={item}
        locale="en"
        graded={false}
        lastResponse={null}
        onSubmit={onSubmit}
      />,
    )

    // The running-side pill only appears once every entry is placed, so count
    // the "credit" labels before and after to isolate it from the column header
    // and the per-entry toggles.
    const creditsBefore = screen.getAllByText('credit').length

    // Assign each entry to its authored side, using that entry's own toggle.
    for (const [i, entry] of item.data.entries.entries()) {
      const toggles = screen.getAllByRole('button', { name: entry.side })
      await user.click(toggles[i])
    }

    // The pill must read "credit" — a receivables account closing on the credit
    // side is the whole point of this item.
    expect(screen.getAllByText('credit').length).toBe(creditsBefore + 1)

    const balance = screen.getByLabelText('closingBalance')
    balance.focus()
    await user.keyboard(String(item.answer.balance))

    await user.click(screen.getByRole('button', { name: 'submit' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(grade(item, onSubmit.mock.calls[0][0])).toBe(true)
  })
})

describe('balancing off — the cold-solve rung of the fading ladder', () => {
  it('fd-1003: every one of the six steps is answerable and grades correct', async () => {
    const user = userEvent.setup()
    const item = faded('fd-1003')
    const onSubmit = vi.fn()
    render(
      <FadedStepItem
        item={item}
        locale="en"
        graded={false}
        lastResponse={null}
        onSubmit={onSubmit}
      />,
    )

    // Nothing is worked for the learner on this rung.
    expect(item.data.steps.every((s) => s.blank)).toBe(true)

    // Each blank renders its own copy of the choice pool, so index the chips by
    // which blank they belong to rather than by label alone.
    let choiceRow = 0
    for (const step of item.data.steps) {
      if (step.kind === 'number') {
        const input = screen.getByLabelText(step.label.en)
        input.focus()
        await user.keyboard(String(step.value))
      } else {
        const chips = screen.getAllByRole('button', { name: step.value })
        await user.click(chips[choiceRow])
        choiceRow++
      }
    }

    await user.click(screen.getByRole('button', { name: 'check' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(grade(item, onSubmit.mock.calls[0][0])).toBe(true)
  })
})
