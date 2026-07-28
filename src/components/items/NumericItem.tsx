import { useState } from 'react'
import type { NumericItem as NumericItemType } from '../../content/types'
import { useKira } from '../../app/KiraContext'
import { Button } from '../ui'
import { AmountInput, formatAmount, type ItemProps } from './shared'

export function NumericItem({ item, locale, graded, lastResponse, onSubmit }: ItemProps) {
  const it = item as NumericItemType
  const { t } = useKira()
  const [val, setVal] = useState<number | ''>('')
  const currency =
    (locale === 'ms' ? it.data.unit_ms : undefined) ?? it.data.unit ?? 'RM'
  const unitAfter = it.data.unitAfter ?? false

  const submitted = graded && typeof lastResponse === 'number' ? lastResponse : null
  const correct = submitted !== null && submitted === it.answer

  return (
    <div className="grid gap-4">
      <AmountInput
        value={graded ? (submitted ?? '') : val}
        onChange={setVal}
        disabled={graded}
        currency={currency}
        unitAfter={unitAfter}
        ariaLabel={t('yourAnswer')}
      />

      {!graded && (
        <Button disabled={val === ''} onClick={() => onSubmit(Number(val))}>
          {t('check')}
        </Button>
      )}

      {graded && !correct && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
          {t('correctAnswer')}: {formatAmount(it.answer, currency, unitAfter)}
        </div>
      )}
    </div>
  )
}
