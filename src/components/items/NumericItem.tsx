import { useState } from 'react'
import type { NumericItem as NumericItemType } from '../../content/types'
import { useKira } from '../../app/KiraContext'
import { Button } from '../ui'
import { AmountInput, formatAmount, type ItemProps } from './shared'

export function NumericItem({ item, graded, lastResponse, onSubmit }: ItemProps) {
  const it = item as NumericItemType
  const { t } = useKira()
  const [val, setVal] = useState<number | ''>('')
  const currency = it.data.unit ?? 'RM'

  const submitted = graded && typeof lastResponse === 'number' ? lastResponse : null
  const correct = submitted !== null && submitted === it.answer

  return (
    <div className="grid gap-4">
      <AmountInput
        value={graded ? (submitted ?? '') : val}
        onChange={setVal}
        disabled={graded}
        currency={currency}
        ariaLabel={t('yourAnswer')}
      />

      {!graded && (
        <Button disabled={val === ''} onClick={() => onSubmit(Number(val))}>
          {t('check')}
        </Button>
      )}

      {graded && !correct && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
          {t('correctAnswer')}: {formatAmount(it.answer, currency)}
        </div>
      )}
    </div>
  )
}
