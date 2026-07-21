import type { ButtonHTMLAttributes, ReactNode } from 'react'

// Shared keyboard focus treatment (WCAG 2.4.7) — applied to all controls.
export const FOCUS =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950'

type Variant = 'primary' | 'secondary' | 'ghost' | 'success'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-500 active:bg-indigo-700 shadow-sm shadow-indigo-600/20 disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-500',
  success:
    'bg-emerald-600 text-white hover:bg-emerald-500 active:bg-emerald-700 shadow-sm',
  secondary:
    'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800',
}

export function Button({
  variant = 'primary',
  className = '',
  children,
  ...rest
}: {
  variant?: Variant
  children: ReactNode
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-5 text-base font-semibold transition-colors select-none disabled:cursor-not-allowed ${FOCUS} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-3xl bg-white p-5 ring-1 ring-slate-200/70 dark:bg-slate-800/60 dark:ring-slate-700/70 ${className}`}
    >
      {children}
    </div>
  )
}

export function ProgressBar({
  value,
  className = '',
  tone = 'indigo',
  label,
}: {
  value: number // 0..100
  className?: string
  tone?: 'indigo' | 'emerald'
  label?: string // distinguishes stacked bars for screen readers
}) {
  const bar = tone === 'emerald' ? 'bg-emerald-500' : 'bg-indigo-500'
  const pct = Math.round(value)
  return (
    <div
      className={`h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700 ${className}`}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      aria-valuetext={label ? `${label}: ${pct}%` : undefined}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${bar}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

export function StatTile({
  value,
  label,
  tone = 'slate',
}: {
  value: ReactNode
  label: string
  tone?: 'slate' | 'indigo' | 'amber' | 'emerald'
}) {
  const tones: Record<string, string> = {
    slate: 'text-slate-900 dark:text-white',
    indigo: 'text-indigo-600 dark:text-indigo-400',
    amber: 'text-amber-500',
    emerald: 'text-emerald-600 dark:text-emerald-400',
  }
  return (
    <div className="flex-1 rounded-2xl bg-white px-3 py-3 text-center ring-1 ring-slate-200/70 dark:bg-slate-800/60 dark:ring-slate-700/70">
      <div className={`text-2xl font-bold tabular-nums ${tones[tone]}`}>{value}</div>
      <div className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </div>
    </div>
  )
}

export function TypeBadge({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold tracking-wide text-indigo-600 uppercase dark:bg-indigo-500/15 dark:text-indigo-300">
      {label}
    </span>
  )
}
