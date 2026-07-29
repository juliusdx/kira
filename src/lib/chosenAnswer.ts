import type { Item, Locale } from '../content/types'
import { t as tc, accountMs, localizedOptions } from '../content/loader'
import { blankSteps } from '../grading/grade'

/**
 * Turn the opaque `chosen` jsonb from `learner_last_wrong` into lines a
 * teacher can read.
 *
 * The database stores what the learner answered but has never known what an
 * item IS — content lives in the bundle — so this is the only place that can
 * make sense of it, and it is deliberately pure so the wording is testable.
 *
 * EVERYTHING here is defensive. `chosen` may be null (rows written before the
 * client synced it), may come from an older build with a different shape, or
 * may simply not match the item any more if the item was re-authored. A
 * teacher screen must degrade to "we don't know" rather than throw.
 */
export interface ChosenLine {
  label: string
  value: string
  /** Whether this particular part was right — the misconception is in the rest. */
  ok: boolean
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function money(n: number, unit = 'RM', after = false): string {
  const v = n.toLocaleString('en-MY')
  if (!after) return `${unit} ${v}`
  return unit === '%' ? `${v}%` : `${v} ${unit}`
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

export function describeChosen(
  item: Item,
  chosen: unknown,
  locale: Locale,
  t: (k: 'debit' | 'credit' | 'closingBalance' | 'yourAnswer') => string,
): ChosenLine[] | null {
  if (chosen === null || chosen === undefined) return null
  const label = (x: { en: string; ms: string }) => tc(x, locale)
  const sideName = (s: unknown) =>
    s === 'debit' ? t('debit') : s === 'credit' ? t('credit') : '—'
  const account = (a: unknown) =>
    typeof a === 'string' ? (locale === 'ms' ? accountMs(a) : a) : '—'

  switch (item.type) {
    case 'classify':
    case 'debit_credit': {
      if (typeof chosen !== 'string') return null
      const opts = localizedOptions(item.data.options, item.data.options_ms, locale)
      const picked = opts.find((o) => o.value === chosen)
      return [
        {
          label: t('yourAnswer'),
          value: picked?.label ?? chosen,
          ok: chosen === item.answer,
        },
      ]
    }

    case 'numeric': {
      const n = num(chosen)
      if (n === null) return null
      return [
        {
          label: t('yourAnswer'),
          value: money(
            n,
            (locale === 'ms' ? item.data.unit_ms : undefined) ?? item.data.unit ?? 'RM',
            item.data.unitAfter ?? false,
          ),
          ok: n === item.answer,
        },
      ]
    }

    case 'journal_entry':
    case 'spot_error': {
      if (!isRecord(chosen)) return null
      const dr = chosen.debit
      const cr = chosen.credit
      if (!isRecord(dr) || !isRecord(cr)) return null
      const ans = item.answer
      return [
        {
          label: t('debit'),
          value: `${account(dr.account)} ${money(num(dr.amount) ?? 0)}`,
          ok: dr.account === ans.debit.account && dr.amount === ans.debit.amount,
        },
        {
          label: t('credit'),
          value: `${account(cr.account)} ${money(num(cr.amount) ?? 0)}`,
          ok: cr.account === ans.credit.account && cr.amount === ans.credit.amount,
        },
      ]
    }

    case 't_account': {
      if (!isRecord(chosen) || !isRecord(chosen.sides)) return null
      const sides = chosen.sides
      const lines: ChosenLine[] = item.data.entries.map((e, i) => ({
        label: label(e.label),
        value: sideName(sides[String(i)]),
        ok: sides[String(i)] === e.side,
      }))
      const bal = num(chosen.balance)
      lines.push({
        label: t('closingBalance'),
        // The side is DERIVED from where she put the entries, so reporting a
        // side here would be reporting our arithmetic, not her answer.
        value: bal === null ? '—' : money(bal),
        ok: bal === item.answer.balance,
      })
      return lines
    }

    case 'statement_build': {
      if (!isRecord(chosen) || !isRecord(chosen.sections)) return null
      const sections = chosen.sections
      const name = new Map(item.data.sections.map((s) => [s.key, label(s.label)]))
      const lines: ChosenLine[] = item.data.lines.map((l, i) => {
        const put = sections[String(i)]
        return {
          label: label(l.label),
          value: typeof put === 'string' ? (name.get(put) ?? put) : '—',
          ok: put === l.section,
        }
      })
      const total = num(chosen.total)
      lines.push({
        label: label(item.data.totalLabel),
        value: total === null ? '—' : money(total),
        ok: total === item.answer.total,
      })
      return lines
    }

    case 'faded_step': {
      if (!isRecord(chosen) || !isRecord(chosen.filled)) return null
      const filled = chosen.filled
      // Only the blanked steps were ever asked; the rest were shown to her.
      return blankSteps(item).map(({ step, index }) => {
        const put = filled[String(index)]
        const ok = put === step.value
        if (step.kind === 'number') {
          const n = num(put)
          return {
            label: label(step.label),
            value:
              n === null
                ? '—'
                : money(
                    n,
                    (locale === 'ms' ? step.unit_ms : undefined) ?? step.unit ?? 'RM',
                    step.unitAfter ?? false,
                  ),
            ok,
          }
        }
        return {
          label: label(step.label),
          value: typeof put === 'string' ? put : '—',
          ok,
        }
      })
    }
  }
}
