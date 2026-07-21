import { useKira } from '../app/KiraContext'

// BM / EN language toggle (persisted to the profile via KiraContext -> Dexie).
export function LocaleToggle() {
  const { locale, setLocale } = useKira()
  const opt = (value: 'ms' | 'en', label: string) => (
    <button
      onClick={() => setLocale(value)}
      aria-pressed={locale === value}
      className={`min-h-8 rounded-full px-3 text-sm font-bold transition-colors ${
        locale === value
          ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-900 dark:text-indigo-300'
          : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      {label}
    </button>
  )
  return (
    <div className="flex items-center rounded-full bg-slate-100 p-1 dark:bg-slate-800">
      {opt('ms', 'BM')}
      {opt('en', 'EN')}
    </div>
  )
}
