import { useState } from 'react'
import type {
  FadedStep,
  FadedStepItem as FadedStepItemType,
  Locale,
} from '../../content/types'
import { t as tc } from '../../content/loader'
import { useKira } from '../../app/KiraContext'
import { blankSteps, fadedChoicePool, type FadedStepResponse } from '../../grading/grade'
import { Button } from '../ui'
import { AccountChip, AmountInput, formatAmount, type ItemProps } from './shared'

// Faded step (Spec §3, type 6) — the backward-fading mechanic. The procedure is
// shown as a worked solution with the last step(s) blanked; the learner supplies
// only what has been faded away. How much is faded is authored per item, so a
// lesson ladders from "fully worked" to "cold solve" (Spec §2).
export function FadedStepItem({
  item,
  locale,
  graded,
  lastResponse,
  onSubmit,
}: ItemProps) {
  const it = item as FadedStepItemType
  const { t } = useKira()
  const { steps } = it.data

  const [filled, setFilled] = useState<Record<number, string | number>>({})

  const view =
    graded && lastResponse && typeof lastResponse === 'object' && 'filled' in lastResponse
      ? (lastResponse as FadedStepResponse)
      : null
  const active = view ? view.filled : filled

  const blanks = blankSteps(it)
  const pool = fadedChoicePool(it)
  const complete = (f: Record<number, string | number>) =>
    blanks.every(({ index }) => f[index] !== undefined && f[index] !== '')
  const canSubmit = complete(active)

  /**
   * Auto-submit only when the WHOLE answer is a single tap — the same
   * commitment a classify item already asks for. A multi-blank item always
   * waits for Check, so an earlier answer can still be revised after the last
   * one is given. Typing never auto-submits either: there is no way to know a
   * number is finished.
   */
  const oneTapAnswer = blanks.length === 1 && blanks[0].step.kind === 'choice'

  const fill = (index: number, value: string | number, fromTap: boolean) => {
    if (graded) return
    // Functional updater, so several taps in one React batch accumulate rather
    // than each overwriting the last.
    setFilled((f) => ({ ...f, [index]: value }))
    // With a single blank, this tap IS the whole answer.
    if (fromTap && oneTapAnswer) onSubmit({ filled: { [index]: value } })
  }

  return (
    <div className="grid gap-4">
      {it.data.scenario && (
        <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
          {tc(it.data.scenario, locale)}
        </p>
      )}

      {!graded && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          {t('fillEachBlank')}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200 dark:ring-slate-700">
        <div className="bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 dark:bg-slate-700/60 dark:text-slate-100">
          {t('workings')}
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {steps.map((step, i) =>
            step.blank ? (
              <BlankStep
                key={i}
                step={step}
                locale={locale}
                pool={pool}
                value={active[i]}
                graded={graded}
                onChange={(v, fromTap) => fill(i, v, fromTap)}
              />
            ) : (
              <WorkedStep key={i} step={step} locale={locale} />
            ),
          )}
        </div>
      </div>

      {!graded && (
        <Button disabled={!canSubmit} onClick={() => onSubmit({ filled })}>
          {t('check')}
        </Button>
      )}
    </div>
  )
}

/** A step already worked for the learner — the model they learn the shape from. */
function WorkedStep({ step, locale }: { step: FadedStep; locale: Locale }) {
  return (
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5">
      <span className="text-sm text-slate-500 dark:text-slate-400">
        {tc(step.label, locale)}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-700 dark:text-slate-200">
        {stepValueLabel(step, locale)}
      </span>
    </div>
  )
}

/** A faded step — the learner supplies this one. */
function BlankStep({
  step,
  locale,
  pool,
  value,
  graded,
  onChange,
}: {
  step: FadedStep
  locale: Locale
  pool: { value: string; value_ms: string }[]
  value: string | number | undefined
  graded: boolean
  /** `fromTap` distinguishes a chip tap (a complete answer) from typing. */
  onChange: (v: string | number, fromTap: boolean) => void
}) {
  const { t } = useKira()
  const label = tc(step.label, locale)
  const correct = graded && value === step.value

  return (
    <div
      className={`grid gap-2 px-4 py-3 ${
        graded
          ? correct
            ? 'bg-emerald-50 dark:bg-emerald-500/10'
            : 'bg-rose-50 dark:bg-rose-500/10'
          : 'bg-indigo-50/60 dark:bg-indigo-500/10'
      }`}
    >
      <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{label}</span>

      {step.kind === 'number' ? (
        <AmountInput
          value={typeof value === 'number' ? value : ''}
          onChange={(v) => onChange(v === '' ? '' : v, false)}
          disabled={graded}
          currency={stepUnit(step, locale)}
          unitAfter={step.unitAfter ?? false}
          ariaLabel={label}
        />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {pool.map((o) => (
            <AccountChip
              key={o.value}
              label={locale === 'ms' ? o.value_ms : o.value}
              selected={value === o.value}
              disabled={graded}
              onClick={() => onChange(o.value, true)}
            />
          ))}
        </div>
      )}

      {graded && !correct && (
        <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          {t('correctAnswer')}: {stepValueLabel(step, locale)}
        </span>
      )}
    </div>
  )
}

/** A number step's unit, in the reading locale ('times' → 'kali'). */
function stepUnit(step: FadedStep, locale: Locale): string {
  if (step.kind !== 'number') return 'RM'
  return (locale === 'ms' ? step.unit_ms : undefined) ?? step.unit ?? 'RM'
}

function stepValueLabel(step: FadedStep, locale: Locale): string {
  if (step.kind === 'number')
    return formatAmount(step.value, stepUnit(step, locale), step.unitAfter ?? false)
  return locale === 'ms' ? step.value_ms : step.value
}
