import { useKira } from '../app/KiraContext'
import { t as tc } from '../content/loader'
import type { Badge } from '../app/badges'
import { Card, ProgressBar } from './ui'

/**
 * All badges, earned first. Locked ones stay visible with their progress —
 * a shelf of unknown blanks motivates nobody, whereas "7 / 10 mastered" is a
 * concrete next step.
 */
export function BadgeShelf({ badges }: { badges: Badge[] }) {
  const { locale, t } = useKira()
  const earned = badges.filter((b) => b.earned)
  const locked = badges.filter((b) => !b.earned)

  return (
    <Card>
      <div className="mb-3 flex items-baseline justify-between">
        <span className="font-bold text-slate-900 dark:text-white">{t('badges')}</span>
        <span className="text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400">
          {earned.length}/{badges.length}
        </span>
      </div>

      {earned.length > 0 && (
        <ul className="mb-4 grid grid-cols-4 gap-3">
          {earned.map((b) => (
            <li key={b.id} className="flex flex-col items-center gap-1 text-center">
              <span className="text-3xl" role="img" aria-label={tc(b.name, locale)}>
                {b.emoji}
              </span>
              <span className="text-[10px] leading-tight font-medium text-slate-600 dark:text-slate-300">
                {tc(b.name, locale)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ul className="grid gap-3">
        {locked.map((b) => (
          <li key={b.id} className="flex items-center gap-3">
            <span
              className="text-2xl opacity-25 grayscale"
              role="img"
              aria-label={tc(b.name, locale)}
            >
              {b.emoji}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">
                  {tc(b.name, locale)}
                </span>
                {b.need != null && (
                  <span className="shrink-0 text-xs tabular-nums text-slate-400">
                    {b.have}/{b.need}
                  </span>
                )}
              </div>
              {b.need != null ? (
                <ProgressBar
                  value={((b.have ?? 0) / b.need) * 100}
                  label={tc(b.name, locale)}
                  className="mt-1.5 h-1.5"
                />
              ) : (
                <p className="mt-0.5 text-xs text-slate-400">{tc(b.desc, locale)}</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
