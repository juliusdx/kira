import { useKira } from '../app/KiraContext'
import { Button, Card } from './ui'
import type { SessionResult } from './SessionScreen'

export function SessionComplete({
  result,
  streak,
  onHome,
}: {
  result: SessionResult
  streak: number
  onHome: () => void
}) {
  const { t } = useKira()
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
      </Card>

      <Button onClick={onHome} className="w-full">
        {t('backHome')}
      </Button>
    </div>
  )
}
