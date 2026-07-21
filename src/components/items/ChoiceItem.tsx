import type { ChoiceItem as ChoiceItemType } from '../../content/types'
import { localizedOptions } from '../../content/loader'
import { FOCUS } from '../ui'
import { ResultIcon, type ItemProps } from './shared'

// Handles both `classify` and `debit_credit` (single-choice). Choice items
// auto-submit on tap for fast drilling — no separate Check step.
export function ChoiceItem({ item, locale, graded, lastResponse, onSubmit }: ItemProps) {
  const it = item as ChoiceItemType
  const opts = localizedOptions(it.data.options, it.data.options_ms, locale)
  const chosen = typeof lastResponse === 'string' ? lastResponse : null
  const twoCol = it.type === 'debit_credit' && opts.length === 2

  return (
    <div className={twoCol ? 'grid grid-cols-2 gap-3' : 'grid gap-3'}>
      {opts.map((o) => {
        const isChosen = chosen === o.value
        const isCorrect = it.answer === o.value

        let cls =
          'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 active:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700'
        if (graded) {
          if (isCorrect)
            cls =
              'bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-200'
          else if (isChosen)
            cls =
              'bg-rose-50 text-rose-800 ring-2 ring-rose-500 dark:bg-rose-500/15 dark:text-rose-200'
          else
            cls =
              'bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-500 dark:ring-slate-700'
        }

        return (
          <button
            key={o.value}
            type="button"
            disabled={graded}
            onClick={() => onSubmit(o.value)}
            className={`flex min-h-16 items-center justify-between gap-2 rounded-2xl px-5 text-left text-lg font-semibold transition-colors disabled:cursor-default ${FOCUS} ${cls} ${
              twoCol ? 'justify-center text-center' : ''
            }`}
          >
            <span>{o.label}</span>
            {graded && (isCorrect || isChosen) && (
              <span className={isCorrect ? 'text-emerald-600' : 'text-rose-600'}>
                <ResultIcon correct={isCorrect} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
