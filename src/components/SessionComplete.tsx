import { useKira } from '../app/KiraContext'
import { t as tc } from '../content/loader'
import type { Badge } from '../app/badges'
import { Button, Card } from './ui'
import type { SessionResult } from './SessionScreen'

export function SessionComplete({
  result,
  streak,
  freshBadges,
  onHome,
}: {
  result: SessionResult
  streak: number
  freshBadges: Badge[]
  onHome: () => void
}) {
  const { locale, t } = useKira()
  const accuracy = result.answered
    ? Math.round((result.correct / result.answered) * 100)
    : 0

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-6 px-5">
      <div className="animate-pop grid place-items-center gap-3 text-center">
        <div className="grid h-20 w-20 place-items-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
          <svg viewBox="0 0 24 24" className="h-11 w-11 text-emerald-600 dark:text-emerald-400" fill="currentColor" aria-hidden>
            <path
              fillRule="evenodd"
              d="M20.3 6.3a1 1 0 0 1 0 1.4l-9 9a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4l3.3 3.29 8.3-8.29a1 1 0 0 1 1.4 0Z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          {t('sessionComplete')}
        </h1>
      </div>

      <Card className="w-full">
        <div className="flex divide-x divide-slate-200 dark:divide-slate-700">
          <div className="flex-1 text-center">
            <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
              {result.answered}
            </div>
            <div className="text-xs font-medium text-slate-500">{t('reviewedN')}</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {accuracy}%
            </div>
            <div className="text-xs font-medium text-slate-500">{t('accuracy')}</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-3xl font-bold tabular-nums text-amber-500">🔥 {streak}</div>
            <div className="text-xs font-medium text-slate-500">{t('streak')}</div>
          </div>
        </div>
        {result.bestCombo >= 2 && (
          <p className="mt-3 border-t border-slate-200 pt-3 text-center text-sm font-semibold text-indigo-600 dark:border-slate-700 dark:text-indigo-400">
            {t('bestRun')}: {result.bestCombo}
          </p>
        )}
      </Card>

      {freshBadges.length > 0 && (
        <Card className="animate-pop w-full ring-2 ring-amber-400/60">
          <p className="text-center text-sm font-semibold text-amber-600 dark:text-amber-400">
            {t('badgeEarned')}
          </p>
          <ul className="mt-3 grid gap-3">
            {freshBadges.map((b) => (
              <li key={b.id} className="flex items-center gap-3">
                <span className="text-3xl" role="img" aria-hidden>
                  {b.emoji}
                </span>
                <div className="min-w-0">
                  <div className="font-bold text-slate-900 dark:text-white">
                    {tc(b.name, locale)}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {tc(b.desc, locale)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Button onClick={onHome} className="w-full">
        {t('backHome')}
      </Button>
    </div>
  )
}
