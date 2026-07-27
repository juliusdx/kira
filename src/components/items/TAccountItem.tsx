import { useRef, useState } from 'react'
import type { TAccountItem as TAccountItemType } from '../../content/types'
import { localizedAccount, accountMs } from '../../content/loader'
import { useKira } from '../../app/KiraContext'
import { Button } from '../ui'
import { tAccountBalance, type TAccountResponse } from '../../grading/grade'
import { AmountInput, DrCrToggle, formatAmount, type ItemProps } from './shared'

export function TAccountItem({ item, locale, graded, lastResponse, onSubmit }: ItemProps) {
  const it = item as TAccountItemType
  const { t } = useKira()
  const entries = it.data.entries
  const accountName = localizedAccount(
    it.data.account,
    [it.data.account],
    [it.data.account_ms ?? accountMs(it.data.account)],
    locale,
  )

  const [sides, setSides] = useState<Record<number, 'debit' | 'credit'>>({})
  const sidesRef = useRef<Record<number, 'debit' | 'credit'>>({})
  const [balance, setBalance] = useState<number | ''>('')

  const view =
    graded && lastResponse && typeof lastResponse === 'object' && 'sides' in lastResponse
      ? (lastResponse as TAccountResponse)
      : null
  const activeSides = view ? view.sides : sides

  const allAssigned = entries.every((_, i) => activeSides[i] != null)
  const running = tAccountBalance(entries, activeSides)
  const canSubmit = allAssigned && balance !== ''

  /**
   * A TAP that completes the item submits it, as a choice item does. Typing the
   * balance never auto-submits, and nor does a tap on an already-complete item —
   * so correcting one of several sides does not commit before you fix the rest.
   *
   * The ref, not `sides`, is the source of truth here: two taps landing in one
   * React batch would both read the same rendered `sides` and the second would
   * drop the first.
   */
  const assign = (i: number, side: 'debit' | 'credit') => {
    if (graded) return
    const prev = sidesRef.current
    const next = { ...prev, [i]: side }
    sidesRef.current = next
    setSides(next)
    const was = entries.every((_, k) => prev[k] != null)
    const now = entries.every((_, k) => next[k] != null)
    if (!was && now && balance !== '') onSubmit({ sides: next, balance: Number(balance) })
  }

  const drTotal = entries.reduce((s, e, i) => (activeSides[i] === 'debit' ? s + e.amount : s), 0)
  const crTotal = entries.reduce((s, e, i) => (activeSides[i] === 'credit' ? s + e.amount : s), 0)

  const shownBalance = view ? view.balance : balance
  const balanceCorrect = view ? view.balance === it.answer.balance : false

  return (
    <div className="grid gap-4">
      {/* Account header + live T totals */}
      <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700">
        <div className="bg-slate-100 px-4 py-2 text-center text-sm font-bold text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
          {accountName}
        </div>
        <div className="grid grid-cols-2 divide-x divide-slate-200 text-center dark:divide-slate-700">
          <div className="px-3 py-2">
            <div className="text-xs font-bold text-sky-600 dark:text-sky-400">{t('debit')}</div>
            <div className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">
              {formatAmount(drTotal)}
            </div>
          </div>
          <div className="px-3 py-2">
            <div className="text-xs font-bold text-amber-600 dark:text-amber-400">{t('credit')}</div>
            <div className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">
              {formatAmount(crTotal)}
            </div>
          </div>
        </div>
      </div>

      {!graded && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {t('tapToAssign')}
        </p>
      )}

      {/* Entries with side toggles */}
      <div className="grid gap-2.5">
        {entries.map((e, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700"
          >
            <div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {e.label[locale]}
              </div>
              <div className="tabular-nums text-xs text-slate-500 dark:text-slate-400">
                {formatAmount(e.amount)}
              </div>
            </div>
            <div className="w-40">
              <DrCrToggle
                value={activeSides[i] ?? null}
                onChange={(side) => assign(i, side)}
                disabled={graded}
                drLabel={t('debit')}
                crLabel={t('credit')}
                reveal={graded ? e.side : undefined}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Closing balance */}
      <div className="grid gap-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-600 dark:text-slate-300">
            {t('closingBalance')}
          </label>
          {allAssigned && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                running.side === 'debit'
                  ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300'
              }`}
            >
              {running.side === 'debit' ? t('debit') : t('credit')}
            </span>
          )}
        </div>
        <AmountInput
          value={shownBalance}
          onChange={setBalance}
          disabled={graded}
          ariaLabel={t('closingBalance')}
        />
      </div>

      {!graded && (
        <Button
          disabled={!canSubmit}
          onClick={() => onSubmit({ sides: sidesRef.current, balance: Number(balance) })}
        >
          {t('submit')}
        </Button>
      )}

      {graded && !balanceCorrect && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
          {t('correctAnswer')}: {formatAmount(it.answer.balance)} (
          {it.answer.side === 'debit' ? t('debit') : t('credit')})
        </div>
      )}
    </div>
  )
}
