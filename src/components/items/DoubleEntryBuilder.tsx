import { useState } from 'react'
import type { JournalLine, Locale } from '../../content/types'
import { localizedAccount } from '../../content/loader'
import { useKira } from '../../app/KiraContext'
import { Button } from '../ui'
import type { JournalResponse } from '../../grading/grade'
import { AccountChip, AmountInput, formatAmount } from './shared'

interface Props {
  accounts: string[]
  accountsMs?: string[]
  answer: { debit: JournalLine; credit: JournalLine }
  graded: boolean
  lastResponse: JournalResponse | null
  onSubmit: (r: JournalResponse) => void
  locale: Locale
  currency?: string
}

/** Build one balanced double entry: pick Dr account + Cr account + amounts. */
export function DoubleEntryBuilder({
  accounts,
  accountsMs,
  answer,
  graded,
  lastResponse,
  onSubmit,
  locale,
  currency = 'RM',
}: Props) {
  const { t } = useKira()
  const [drAcc, setDrAcc] = useState<string | null>(null)
  const [crAcc, setCrAcc] = useState<string | null>(null)
  const [drAmt, setDrAmt] = useState<number | ''>('')
  const [crAmt, setCrAmt] = useState<number | ''>('')

  const label = (a: string) => localizedAccount(a, accounts, accountsMs, locale)

  const balanced = drAmt !== '' && crAmt !== '' && drAmt === crAmt && drAmt > 0
  const canSubmit = !!drAcc && !!crAcc && balanced

  const view = graded && lastResponse ? lastResponse : null
  const lineOk = (a: JournalLine, b: JournalLine) =>
    a.account === b.account && a.amount === b.amount

  if (graded && view) {
    const drCorrect = lineOk(view.debit, answer.debit)
    const crCorrect = lineOk(view.credit, answer.credit)
    const allCorrect = drCorrect && crCorrect
    return (
      <div className="grid gap-3">
        <GradedLine
          side={t('debit')}
          tone="sky"
          account={label(view.debit.account)}
          amount={formatAmount(view.debit.amount, currency)}
          ok={drCorrect}
        />
        <GradedLine
          side={t('credit')}
          tone="amber"
          account={label(view.credit.account)}
          amount={formatAmount(view.credit.amount, currency)}
          ok={crCorrect}
        />
        {!allCorrect && (
          <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
            <div className="mb-1 font-bold">{t('correctAnswer')}</div>
            <div className="font-semibold">
              {t('debit')} {label(answer.debit.account)} —{' '}
              {formatAmount(answer.debit.amount, currency)}
            </div>
            <div className="font-semibold">
              {t('credit')} {label(answer.credit.account)} —{' '}
              {formatAmount(answer.credit.amount, currency)}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <Row
        side={t('debit')}
        tone="sky"
        accounts={accounts}
        label={label}
        graded={graded}
        currency={currency}
        amountLabel={t('amount')}
        selected={drAcc}
        onPick={setDrAcc}
        amount={drAmt}
        onAmount={setDrAmt}
      />
      <Row
        side={t('credit')}
        tone="amber"
        accounts={accounts}
        label={label}
        graded={graded}
        currency={currency}
        amountLabel={t('amount')}
        selected={crAcc}
        onPick={setCrAcc}
        amount={crAmt}
        onAmount={setCrAmt}
      />

      <div
        className={`text-center text-sm font-semibold ${
          balanced
            ? 'text-emerald-600 dark:text-emerald-400'
            : 'text-slate-400 dark:text-slate-500'
        }`}
        aria-live="polite"
      >
        {balanced ? `✓ ${t('balanced')}` : t('mustBalance')}
      </div>

      <Button
        disabled={!canSubmit}
        onClick={() =>
          onSubmit({
            debit: { account: drAcc!, amount: Number(drAmt) },
            credit: { account: crAcc!, amount: Number(crAmt) },
          })
        }
      >
        {t('submit')}
      </Button>
    </div>
  )
}

// Module-scope so its element type is stable across renders — otherwise React
// would remount the <input> on every keystroke and drop focus.
function Row({
  side,
  tone,
  accounts,
  label,
  graded,
  currency,
  amountLabel,
  selected,
  onPick,
  amount,
  onAmount,
}: {
  side: string
  tone: 'sky' | 'amber'
  accounts: string[]
  label: (a: string) => string
  graded: boolean
  currency: string
  amountLabel: string
  selected: string | null
  onPick: (a: string) => void
  amount: number | ''
  onAmount: (v: number | '') => void
}) {
  const dot = tone === 'sky' ? 'bg-sky-500' : 'bg-amber-500'
  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-300">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        {side}
      </div>
      <div className="flex flex-wrap gap-2">
        {accounts.map((a) => (
          <AccountChip
            key={a}
            label={label(a)}
            selected={selected === a}
            disabled={graded}
            onClick={() => onPick(a)}
          />
        ))}
      </div>
      <AmountInput
        value={amount}
        onChange={onAmount}
        disabled={graded}
        currency={currency}
        ariaLabel={`${side} ${amountLabel}`}
      />
    </div>
  )
}

function GradedLine({
  side,
  tone,
  account,
  amount,
  ok,
}: {
  side: string
  tone: 'sky' | 'amber'
  account: string
  amount: string
  ok: boolean
}) {
  const dot = tone === 'sky' ? 'bg-sky-500' : 'bg-amber-500'
  const ring = ok
    ? 'ring-emerald-400 bg-emerald-50 dark:bg-emerald-500/10'
    : 'ring-rose-400 bg-rose-50 dark:bg-rose-500/10'
  return (
    <div className={`flex items-center justify-between rounded-xl px-4 py-3 ring-1 ${ring}`}>
      <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
        {side} · {account}
      </div>
      <div className="tabular-nums font-bold text-slate-700 dark:text-slate-200">
        {amount}
      </div>
    </div>
  )
}
