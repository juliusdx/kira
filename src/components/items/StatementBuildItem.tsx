import { useRef, useState } from 'react'
import type {
  StatementBuildItem as StatementBuildItemType,
  StatementSection,
} from '../../content/types'
import { t as tc } from '../../content/loader'
import { useKira } from '../../app/KiraContext'
import { Button, FOCUS } from '../ui'
import { sectionTotals, type StatementResponse } from '../../grading/grade'
import { AmountInput, formatAmount, type ItemProps } from './shared'

// Statement build (Spec §3, type 7): sort each line into the right part of the
// statement, then compute the resulting figure (net profit, capital, ...).
export function StatementBuildItem({
  item,
  locale,
  graded,
  lastResponse,
  onSubmit,
}: ItemProps) {
  const it = item as StatementBuildItemType
  const { t } = useKira()
  const { lines, sections } = it.data

  const [assigned, setAssigned] = useState<Record<number, string>>({})
  // Ref, not state: two taps in one React batch would otherwise overwrite
  // each other instead of accumulating.
  const assignedRef = useRef<Record<number, string>>({})
  const [total, setTotal] = useState<number | ''>('')

  const view =
    graded && lastResponse && typeof lastResponse === 'object' && 'sections' in lastResponse
      ? (lastResponse as StatementResponse)
      : null
  const active = view ? view.sections : assigned

  const allAssigned = lines.every((_, i) => active[i] != null)
  const canSubmit = allAssigned && total !== ''
  const totals = sectionTotals(lines, active)

  /**
   * A TAP that completes the item submits it, as a choice item does. Typing the
   * figure never auto-submits, and nor does a tap on an already-complete item —
   * so re-sorting one line does not commit before you fix the others.
   */
  const assign = (i: number, key: string) => {
    if (graded) return
    const prev = assignedRef.current
    const next = { ...prev, [i]: key }
    assignedRef.current = next
    setAssigned(next)
    const was = lines.every((_, k) => prev[k] != null)
    const now = lines.every((_, k) => next[k] != null)
    if (!was && now && total !== '') onSubmit({ sections: next, total: Number(total) })
  }

  const shownTotal = view ? view.total : total
  const totalCorrect = view ? view.total === it.answer.total : false

  return (
    <div className="grid gap-4">
      {/* Statement header with live section subtotals */}
      <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700">
        <div className="bg-slate-100 px-4 py-2 text-center text-sm font-bold text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
          {tc(it.data.statement, locale)}
        </div>
        <div
          className="grid divide-x divide-slate-200 text-center dark:divide-slate-700"
          style={{ gridTemplateColumns: `repeat(${sections.length}, minmax(0, 1fr))` }}
        >
          {sections.map((s) => (
            <div key={s.key} className="px-3 py-2">
              <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                {tc(s.label, locale)}
              </div>
              <div className="tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                {formatAmount(totals[s.key] ?? 0)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!graded && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {t('sortEachLine')}
        </p>
      )}

      {/* Lines */}
      <div className="grid gap-2.5">
        {lines.map((line, i) => (
          <div
            key={i}
            className="grid gap-2 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200 dark:bg-slate-800/60 dark:ring-slate-700"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {tc(line.label, locale)}
              </span>
              <span className="shrink-0 tabular-nums text-xs text-slate-500 dark:text-slate-400">
                {formatAmount(line.amount)}
              </span>
            </div>
            <SectionToggle
              sections={sections}
              locale={locale}
              value={active[i] ?? null}
              disabled={graded}
              reveal={graded ? line.section : undefined}
              onChange={(key) => assign(i, key)}
            />
          </div>
        ))}
      </div>

      {/* Resulting figure */}
      <div className="grid gap-2">
        <label className="text-sm font-bold text-slate-600 dark:text-slate-300">
          {tc(it.data.totalLabel, locale)}
        </label>
        <AmountInput
          value={shownTotal}
          onChange={setTotal}
          disabled={graded}
          ariaLabel={tc(it.data.totalLabel, locale)}
        />
      </div>

      {!graded && (
        <Button
          disabled={!canSubmit}
          onClick={() => onSubmit({ sections: assignedRef.current, total: Number(total) })}
        >
          {t('submit')}
        </Button>
      )}

      {graded && !totalCorrect && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
          {t('correctAnswer')}: {formatAmount(it.answer.total)}
        </div>
      )}
    </div>
  )
}

// Module scope: keeps the element type stable so inputs/buttons are reconciled
// rather than remounted on every render.
function SectionToggle({
  sections,
  locale,
  value,
  onChange,
  disabled,
  reveal,
}: {
  sections: StatementSection[]
  locale: 'en' | 'ms'
  value: string | null
  onChange: (key: string) => void
  disabled?: boolean
  reveal?: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {sections.map((s) => {
        const active = value === s.key
        const isCorrect = reveal === s.key
        const isWrongPick = reveal && active && reveal !== s.key

        let cls =
          'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
        if (active) cls = 'bg-indigo-600 text-white ring-1 ring-indigo-600'
        if (reveal) {
          if (isCorrect) cls = 'bg-emerald-600 text-white ring-1 ring-emerald-600'
          else if (isWrongPick) cls = 'bg-rose-600 text-white ring-1 ring-rose-600'
          else
            cls =
              'bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700'
        }

        return (
          <button
            key={s.key}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(s.key)}
            className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-bold transition-colors ${FOCUS} ${cls}`}
          >
            {tc(s.label, locale)}
          </button>
        )
      })}
    </div>
  )
}
