import type { Item, Locale, LocalizedText } from '../content/types'
import { t as tc, accountMs, localizedOptions } from '../content/loader'
import { blankSteps, fadedChoicePool } from '../grading/graders'
import { useKira } from '../app/KiraContext'

// The question as the learner met it, rendered READ-ONLY for a teacher.
//
// This is deliberately NOT the interactive renderer. A teacher looking at a
// miss wants to read the question and see the answer beside it, not to be
// handed a gradeable widget that would record an attempt against their own
// account. It also stays on the sober teacher design language — the roster is
// a progress report, not a game.

function Row({
  label,
  value,
  correct = false,
}: {
  label: string
  value: string
  correct?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="min-w-0 text-slate-600 dark:text-slate-300">{label}</span>
      <span
        className={`shrink-0 tabular-nums font-semibold ${
          correct
            ? 'text-emerald-700 dark:text-emerald-300'
            : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

/** An option chip; the correct one is marked, the rest are what was on offer. */
function Option({ label, correct }: { label: string; correct: boolean }) {
  return (
    <span
      className={`rounded-lg px-2.5 py-1 text-sm font-medium ring-1 ${
        correct
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-200 dark:ring-emerald-700'
          : 'bg-slate-50 text-slate-500 ring-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700'
      }`}
    >
      {correct ? `✓ ${label}` : label}
    </span>
  )
}

/**
 * The exhaustiveness backstop for `Body`'s switch. Typed `never`, so a new
 * member of the `Item` union stops compiling here; returns null rather than
 * throwing, so an item re-authored to a type this build predates degrades to
 * an empty panel instead of taking the teacher's report down with it.
 */
function unhandledType(item: never): null {
  console.warn('[kira] ItemPreview: unhandled item type', item)
  return null
}

function money(n: number, unit = 'RM', after = false): string {
  const v = n.toLocaleString('en-MY')
  if (!after) return `${unit} ${v}`
  return unit === '%' ? `${v}%` : `${v} ${unit}`
}

function side(s: 'debit' | 'credit', t: (k: 'debit' | 'credit') => string): string {
  return s === 'debit' ? t('debit') : t('credit')
}

export function ItemPreview({ item, locale }: { item: Item; locale: Locale }) {
  const { t } = useKira()
  const label = (x: LocalizedText) => tc(x, locale)

  return (
    <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-slate-900/40 dark:ring-slate-700">
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
        {label(item.prompt)}
      </p>
      <div className="mt-2 border-t border-slate-200 pt-2 dark:border-slate-700">
        <Body item={item} locale={locale} />
      </div>
    </div>
  )

  function Body({ item, locale }: { item: Item; locale: Locale }) {
    switch (item.type) {
      case 'classify':
      case 'debit_credit':
        return (
          <div className="flex flex-wrap gap-1.5">
            {localizedOptions(item.data.options, item.data.options_ms, locale).map(
              (o) => (
                <Option key={o.value} label={o.label} correct={o.value === item.answer} />
              ),
            )}
          </div>
        )

      case 'numeric':
        return (
          <Row
            label={t('correctAnswer')}
            value={money(
              item.answer,
              (locale === 'ms' ? item.data.unit_ms : undefined) ??
                item.data.unit ??
                'RM',
              item.data.unitAfter ?? false,
            )}
            correct
          />
        )

      case 'journal_entry':
      case 'spot_error':
        return (
          <div>
            {item.type === 'spot_error' && (
              <div className="mb-2 rounded-lg bg-rose-50 px-2.5 py-1.5 dark:bg-rose-500/10">
                <p className="text-[11px] font-semibold tracking-wide text-rose-700 uppercase dark:text-rose-300">
                  {t('previewGivenEntry')}
                </p>
                <Row
                  label={`${t('debit')} ${accountLabel(item.data.given.debit.account)}`}
                  value={money(item.data.given.debit.amount)}
                />
                <Row
                  label={`${t('credit')} ${accountLabel(item.data.given.credit.account)}`}
                  value={money(item.data.given.credit.amount)}
                />
              </div>
            )}
            <Row
              label={`${t('debit')} ${accountLabel(item.answer.debit.account)}`}
              value={money(item.answer.debit.amount)}
              correct
            />
            <Row
              label={`${t('credit')} ${accountLabel(item.answer.credit.account)}`}
              value={money(item.answer.credit.amount)}
              correct
            />
          </div>
        )

      case 't_account':
        return (
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {locale === 'ms'
                ? (item.data.account_ms ?? accountMs(item.data.account))
                : item.data.account}
            </p>
            {item.data.entries.map((e, i) => (
              <Row
                key={i}
                label={label(e.label)}
                value={`${money(e.amount)} · ${side(e.side, t)}`}
              />
            ))}
            <div className="mt-1 border-t border-slate-200 pt-1 dark:border-slate-700">
              <Row
                label={t('closingBalance')}
                value={`${money(item.answer.balance)} · ${side(item.answer.side, t)}`}
                correct
              />
            </div>
          </div>
        )

      case 'statement_build': {
        const sectionLabel = new Map(item.data.sections.map((s) => [s.key, label(s.label)]))
        return (
          <div>
            <p className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">
              {label(item.data.statement)}
            </p>
            {item.data.lines.map((l, i) => (
              <Row
                key={i}
                label={label(l.label)}
                value={`${money(l.amount)} · ${sectionLabel.get(l.section) ?? l.section}`}
              />
            ))}
            <div className="mt-1 border-t border-slate-200 pt-1 dark:border-slate-700">
              <Row
                label={label(item.data.totalLabel)}
                value={money(item.answer.total)}
                correct
              />
            </div>
          </div>
        )
      }

      case 'faded_step': {
        const asked = new Set(blankSteps(item).map(({ index }) => index))
        const pool = fadedChoicePool(item)
        return (
          <div>
            {item.data.scenario && (
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                {label(item.data.scenario)}
              </p>
            )}
            {item.data.steps.map((step, i) => (
              <Row
                key={i}
                // The blanked steps are the only ones the learner had to
                // supply — a teacher reading a 7-line working needs to see
                // which lines were actually the question.
                label={asked.has(i) ? `${label(step.label)} ${t('previewAsked')}` : label(step.label)}
                value={
                  step.kind === 'number'
                    ? money(
                        step.value,
                        (locale === 'ms' ? step.unit_ms : undefined) ?? step.unit ?? 'RM',
                        step.unitAfter ?? false,
                      )
                    : locale === 'ms'
                      ? step.value_ms
                      : step.value
                }
                correct={asked.has(i)}
              />
            ))}
            {pool.length > 1 && blankSteps(item).some((b) => b.step.kind === 'choice') && (
              <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200 pt-2 dark:border-slate-700">
                {pool.map((o) => (
                  <Option
                    key={o.value}
                    label={locale === 'ms' ? o.value_ms : o.value}
                    correct={blankSteps(item).some(
                      ({ step }) => step.kind === 'choice' && step.value === o.value,
                    )}
                  />
                ))}
              </div>
            )}
          </div>
        )
      }

      // `Body` has no declared return type, so without this arm inference
      // absorbs the fall-through: a newly added item type would compile
      // cleanly and render NOTHING on the teacher's screen. `item` narrows to
      // `never` here only while the switch above is exhaustive, so adding a
      // type is a compile error at this line — which is the point. The
      // runtime path still degrades rather than throwing, because a progress
      // report must not blank out over one re-authored item.
      default:
        return unhandledType(item)
    }
  }

  function accountLabel(account: string): string {
    return locale === 'ms' ? accountMs(account) : account
  }
}
