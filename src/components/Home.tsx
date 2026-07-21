import type { ProgressSummary } from '../app/progress'
import { useKira } from '../app/KiraContext'
import { Button, Card, StatTile } from './ui'
import { LocaleToggle } from './LocaleToggle'

export function Home({
  summary,
  streak,
  onStart,
  onOpenProgress,
}: {
  summary: ProgressSummary
  streak: number
  onStart: () => void
  onOpenProgress: () => void
}) {
  const { t } = useKira()
  const nothingToDo = summary.dueCount === 0 && summary.newCount === 0
  const startLabel = summary.seenCount > 0 ? t('continue') : t('start')

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5">
      <header className="safe-top flex items-center justify-between pt-3 pb-2">
        <div className="flex items-center gap-2.5">
          <img
            src={`${import.meta.env.BASE_URL}icon.svg`}
            alt=""
            className="h-9 w-9 rounded-xl"
          />
          <span className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('appName')}
          </span>
        </div>
        <LocaleToggle />
      </header>

      <div className="flex flex-1 flex-col justify-center gap-6 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {t('tagline')}
          </h1>
        </div>

        <div className="flex gap-3">
          <StatTile value={summary.dueCount} label={t('dueToday')} tone="indigo" />
          <StatTile value={summary.newCount} label={t('newToday')} tone="slate" />
          <StatTile value={streak} label={t('streak')} tone="amber" />
        </div>

        {nothingToDo ? (
          <Card className="text-center">
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {t('allDone')}
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('allDoneSub')}
            </p>
          </Card>
        ) : (
          <Button onClick={onStart} className="text-lg">
            {startLabel}
          </Button>
        )}

        <button
          onClick={onOpenProgress}
          className="mx-auto text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
        >
          {t('progress')} →
        </button>
      </div>

      <footer className="safe-bottom flex items-center justify-center gap-1.5 pb-3 text-xs text-slate-400">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
        {t('offlineReady')}
      </footer>
    </div>
  )
}
