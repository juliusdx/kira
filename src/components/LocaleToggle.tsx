import { useKira } from '../app/KiraContext'
import { FOCUS } from './ui'

/**
 * BM / EN language toggle (persisted to the profile via KiraContext -> Dexie).
 * `sm` is the in-session variant — the same control, sized to sit in the
 * session top bar so the language can be switched on any question rather than
 * only before starting.
 */
export function LocaleToggle({ size = 'md' }: { size?: 'md' | 'sm' }) {
  const { locale, setLocale } = useKira()
  const sm = size === 'sm'

  const opt = (value: 'ms' | 'en', label: string, name: string) => (
    <button
      onClick={() => setLocale(value)}
      aria-pressed={locale === value}
      aria-label={name}
      className={`rounded-full font-bold transition-colors ${FOCUS} ${
        sm ? 'min-h-9 px-2.5 text-xs' : 'min-h-8 px-3 text-sm'
      } ${
        locale === value
          ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
          : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div
      className={`flex shrink-0 items-center rounded-full bg-slate-100 dark:bg-slate-800 ${
        sm ? 'p-0.5' : 'p-1'
      }`}
    >
      {opt('ms', 'BM', 'Bahasa Malaysia')}
      {opt('en', 'EN', 'English')}
    </div>
  )
}
