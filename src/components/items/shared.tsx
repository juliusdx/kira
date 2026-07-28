import type { Item, Locale } from '../../content/types'
import type { Response } from '../../grading/grade'
import { FOCUS } from '../ui'

/** Uniform contract every question-type renderer implements. */
export interface ItemProps {
  item: Item
  locale: Locale
  graded: boolean
  lastResponse: Response | null
  onSubmit: (r: Response) => void
}

/**
 * A currency leads its figure (`RM 30`), a ratio unit trails it (`30%`,
 * `8 times`). `%` sits tight against the number; a word unit takes a space.
 */
export function formatAmount(n: number, unit = 'RM', unitAfter = false): string {
  const value = n.toLocaleString('en-MY')
  if (!unitAfter) return `${unit} ${value}`
  return unit === '%' ? `${value}%` : `${value} ${unit}`
}

/** Tappable account chip used by journal-entry / spot-error builders. */
export function AccountChip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string
  selected: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      className={`min-h-11 rounded-xl px-3 text-sm font-semibold transition-colors disabled:opacity-60 ${FOCUS} ${
        selected
          ? 'bg-indigo-600 text-white ring-1 ring-indigo-600'
          : 'bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-slate-200 dark:bg-slate-700/60 dark:text-slate-200 dark:ring-slate-600'
      }`}
    >
      {label}
    </button>
  )
}

/** Currency-prefixed numeric input. */
export function AmountInput({
  value,
  onChange,
  disabled,
  currency = 'RM',
  unitAfter = false,
  ariaLabel,
}: {
  value: number | ''
  onChange: (v: number | '') => void
  disabled?: boolean
  currency?: string
  /** Put the unit after the field — `30 %`, `8 times` — instead of before it. */
  unitAfter?: boolean
  ariaLabel: string
}) {
  const unit = (
    <span
      className={`text-sm font-semibold text-slate-500 dark:text-slate-400 ${
        unitAfter ? 'pr-3' : 'pl-3'
      }`}
    >
      {currency}
    </span>
  )
  return (
    <div
      className={`flex items-center rounded-xl bg-slate-100 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-indigo-500 dark:bg-slate-700/60 dark:ring-slate-600 ${
        disabled ? 'opacity-70' : ''
      }`}
    >
      {!unitAfter && unit}
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={ariaLabel}
        disabled={disabled}
        enterKeyHint="done"
        value={value === '' ? '' : value}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^0-9]/g, '')
          onChange(digits === '' ? '' : Number(digits))
        }}
        className="min-h-11 w-full bg-transparent px-2 text-base font-semibold text-slate-900 outline-none tabular-nums dark:text-white"
        placeholder="0"
      />
      {unitAfter && unit}
    </div>
  )
}

/** Debit / Credit segmented toggle used by the T-account renderer. */
export function DrCrToggle({
  value,
  onChange,
  disabled,
  drLabel,
  crLabel,
  reveal,
}: {
  value: 'debit' | 'credit' | null
  onChange: (v: 'debit' | 'credit') => void
  disabled?: boolean
  drLabel: string
  crLabel: string
  reveal?: 'debit' | 'credit' // when graded, the correct side to highlight green
}) {
  const seg = (side: 'debit' | 'credit', label: string) => {
    const active = value === side
    const isCorrect = reveal === side
    const isWrongPick = reveal && active && reveal !== side
    let cls =
      'bg-white text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600'
    if (active)
      cls =
        side === 'debit'
          ? 'bg-sky-600 text-white ring-1 ring-sky-600'
          : 'bg-amber-500 text-white ring-1 ring-amber-500'
    if (reveal) {
      if (isCorrect) cls = 'bg-emerald-600 text-white ring-1 ring-emerald-600'
      else if (isWrongPick) cls = 'bg-rose-600 text-white ring-1 ring-rose-600'
      else
        cls =
          'bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700'
    }
    return (
      <button
        type="button"
        disabled={disabled}
        aria-pressed={active}
        onClick={() => onChange(side)}
        className={`min-h-11 flex-1 rounded-lg px-2 text-sm font-bold transition-colors ${FOCUS} ${cls}`}
      >
        {label}
      </button>
    )
  }
  return (
    <div className="flex gap-1.5">
      {seg('debit', drLabel)}
      {seg('credit', crLabel)}
    </div>
  )
}

export function ResultIcon({ correct }: { correct: boolean }) {
  return correct ? (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 20 20" className="h-5 w-5 shrink-0" fill="currentColor" aria-hidden>
      <path
        fillRule="evenodd"
        d="M10 8.6 6.4 5 5 6.4 8.6 10 5 13.6 6.4 15 10 11.4 13.6 15 15 13.6 11.4 10 15 6.4 13.6 5 10 8.6Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

export function itemTypeLabel(item: Item, locale: Locale): string {
  const labels: Record<Item['type'], { en: string; ms: string }> = {
    classify: { en: 'Classify', ms: 'Kelaskan' },
    debit_credit: { en: 'Debit or Credit', ms: 'Debit atau Kredit' },
    numeric: { en: 'Solve', ms: 'Selesaikan' },
    journal_entry: { en: 'Journal entry', ms: 'Catatan jurnal' },
    t_account: { en: 'T-account', ms: 'Akaun T' },
    spot_error: { en: 'Spot the error', ms: 'Kesan kesilapan' },
    statement_build: { en: 'Build the statement', ms: 'Bina penyata' },
    faded_step: { en: 'Fill the step', ms: 'Isi langkah' },
  }
  return labels[item.type][locale]
}
