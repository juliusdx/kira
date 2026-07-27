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

describe('DoubleEntryBuilder — a tap that completes a balanced entry submits it', () => {
  it('picking the last account auto-submits once the amounts balance', async () => {
    const user = userEvent.setup()
    const onSubmit = renderBuilder()

    // amounts first, then accounts — so the completing action is a TAP
    const dr = screen.getByLabelText('debit amount') as HTMLInputElement
    dr.focus()
    await user.keyboard('12000')
    const cr = screen.getByLabelText('credit amount') as HTMLInputElement
    cr.focus()
    await user.keyboard('12000')
    expect(onSubmit).not.toHaveBeenCalled() // typing alone never commits

    await user.click(screen.getAllByRole('button', { name: 'Van' })[0]) // debit
    expect(onSubmit).not.toHaveBeenCalled() // only one account picked

    await user.click(screen.getAllByRole('button', { name: 'Cash' })[1]) // credit
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith(answer)
  })

  it('does not auto-submit while the entry is unbalanced', async () => {
    const user = userEvent.setup()
    const onSubmit = renderBuilder()

    const dr = screen.getByLabelText('debit amount') as HTMLInputElement
    dr.focus()
    await user.keyboard('12000') // credit amount left empty

    await user.click(screen.getAllByRole('button', { name: 'Van' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Cash' })[1])
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('changing an account after both are picked does not commit early', async () => {
    const user = userEvent.setup()
    const onSubmit = renderBuilder()

    // both accounts first, THEN the amounts — completing action is typing
    await user.click(screen.getAllByRole('button', { name: 'Van' })[0])
    await user.click(screen.getAllByRole('button', { name: 'Cash' })[1])
    const dr = screen.getByLabelText('debit amount') as HTMLInputElement
    dr.focus()
    await user.keyboard('12000')
    const cr = screen.getByLabelText('credit amount') as HTMLInputElement
    cr.focus()
    await user.keyboard('12000')
    expect(onSubmit).not.toHaveBeenCalled()

    // re-picking the debit account must not fire — the learner may still want
    // to change the credit side too.
    await user.click(screen.getAllByRole('button', { name: 'Capital' })[0])
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
