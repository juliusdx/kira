import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DoubleEntryBuilder } from './DoubleEntryBuilder'

// Avoid the Dexie-backed context in a pure component test.
vi.mock('../../app/KiraContext', () => ({
  useKira: () => ({ locale: 'en', t: (k: string) => k }),
}))

const answer = {
  debit: { account: 'Van', amount: 12000 },
  credit: { account: 'Cash', amount: 12000 },
}

function renderBuilder(onSubmit = vi.fn()) {
  render(
    <DoubleEntryBuilder
      accounts={['Cash', 'Van', 'Capital', 'Sales']}
      answer={answer}
      graded={false}
      lastResponse={null}
      onSubmit={onSubmit}
      locale="en"
    />,
  )
  return onSubmit
}

describe('DoubleEntryBuilder — amount input keeps focus across keystrokes', () => {
  it('accumulates multi-digit input without remounting the field (regression: inline Row)', async () => {
    const user = userEvent.setup()
    renderBuilder()

    const drAmount = screen.getByLabelText('debit amount') as HTMLInputElement
    drAmount.focus()
    // Type digit-by-digit. If the field remounted per keystroke it would lose
    // focus and drop everything after the first digit.
    await user.keyboard('12000')

    expect(drAmount.value).toBe('12000')
    // same DOM node throughout — proof it was not remounted
    expect(screen.getByLabelText('debit amount')).toBe(drAmount)
  })

  it('typing still works after selecting an account (re-render mid-entry)', async () => {
    const user = userEvent.setup()
    const onSubmit = renderBuilder()

    await user.click(screen.getAllByRole('button', { name: 'Van' })[0]) // debit account
    const drAmount = screen.getByLabelText('debit amount') as HTMLInputElement
    drAmount.focus()
    await user.keyboard('12000')
    expect(drAmount.value).toBe('12000')

    await user.click(screen.getAllByRole('button', { name: 'Cash' })[1]) // credit account
    const crAmount = screen.getByLabelText('credit amount') as HTMLInputElement
    crAmount.focus()
    await user.keyboard('12000')
    expect(crAmount.value).toBe('12000')

    // balanced + correct -> submit fires with the built entry
    await user.click(screen.getByRole('button', { name: 'submit' }))
    expect(onSubmit).toHaveBeenCalledWith(answer)
  })
})
