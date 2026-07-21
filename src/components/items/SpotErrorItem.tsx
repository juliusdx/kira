import type { SpotErrorItem as SpotErrorItemType } from '../../content/types'
import { accountMs, localizedAccount } from '../../content/loader'
import { useKira } from '../../app/KiraContext'
import type { JournalResponse } from '../../grading/grade'
import { DoubleEntryBuilder } from './DoubleEntryBuilder'
import { formatAmount, type ItemProps } from './shared'

export function SpotErrorItem({ item, locale, graded, lastResponse, onSubmit }: ItemProps) {
  const it = item as SpotErrorItemType
  const { t } = useKira()
  const given = it.data.given

  // Account pool: what's plausible = accounts appearing in the wrong entry and
  // the correction (deduped, stable order).
  const pool = it.data.accounts ?? [
    ...new Set([
      given.debit.account,
      given.credit.account,
      it.answer.debit.account,
      it.answer.credit.account,
    ]),
  ]
  const poolMs = it.data.accounts_ms ?? pool.map(accountMs)
  const label = (a: string) => localizedAccount(a, pool, poolMs, locale)

  return (
    <div className="grid gap-4">
      {/* The incorrect entry as recorded */}
      <div className="rounded-2xl bg-rose-50 px-4 py-3 ring-1 ring-rose-200 dark:bg-rose-500/10 dark:ring-rose-500/30">
        <div className="mb-1.5 text-xs font-bold tracking-wide text-rose-500 uppercase">
          {locale === 'ms' ? 'Direkod sebagai' : 'Recorded as'}
        </div>
        <div className="font-semibold text-slate-700 line-through decoration-rose-400 dark:text-slate-200">
          {t('debit')} {label(given.debit.account)} —{' '}
          {formatAmount(given.debit.amount)}
        </div>
        <div className="font-semibold text-slate-700 line-through decoration-rose-400 dark:text-slate-200">
          {t('credit')} {label(given.credit.account)} —{' '}
          {formatAmount(given.credit.amount)}
        </div>
      </div>

      <DoubleEntryBuilder
        accounts={pool}
        accountsMs={poolMs}
        answer={it.answer}
        graded={graded}
        lastResponse={lastResponse as JournalResponse | null}
        onSubmit={onSubmit}
        locale={locale}
      />
    </div>
  )
}
