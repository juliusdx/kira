import type { ProgressSummary } from '../app/progress'
import { t as tc } from '../content/loader'
import { useKira } from '../app/KiraContext'
import { Button, Card, FOCUS, ProgressBar } from './ui'
import { BadgeShelf } from './BadgeShelf'
import type { Badge } from '../app/badges'

export function Progress({
  summary,
  badges,
  onBack,
  onReset,
  onOpenAccount,
  onOpenClasses,
}: {
  summary: ProgressSummary
  badges: Badge[]
  onBack: () => void
  onReset: () => void
  /** omitted when cloud sync is not configured */
  onOpenAccount?: () => void
  onOpenClasses?: () => void
}) {
  const { locale, t } = useKira()

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5">
      <header className="safe-top flex items-center gap-3 pt-3 pb-2">
        <button
          onClick={onBack}
          aria-label={t('backHome')}
          className={`grid h-11 w-11 place-items-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${FOCUS}`}
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M12.5 4.4 6.9 10l5.6 5.6-1.4 1.4L4 10l7.1-7 1.4 1.4Z" />
          </svg>
        </button>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">
          {t('progress')}
        </h1>
      </header>

      <div className="flex-1 space-y-4 py-4">
        {/* Overall */}
        <Card>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-bold text-slate-900 dark:text-white">{t('mastery')}</span>
            <span className="text-2xl font-extrabold tabular-nums text-indigo-600 dark:text-indigo-400">
              {summary.overallPct}%
            </span>
          </div>
          <ProgressBar value={summary.overallPct} label={t('mastery')} />
          <div className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {summary.masteredCount}/{summary.totalItems} {t('itemsMastered')} ·{' '}
            {summary.seenCount} {t('seen')}
          </div>
        </Card>

        {/* Per-topic */}
        <div className="space-y-3">
          {summary.topics.map((tp) => (
            <Card key={tp.topic.id}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <span className="font-semibold text-slate-800 dark:text-slate-100">
                  {tc(tp.topic.title, locale)}
                </span>
                <span className="shrink-0 text-sm font-bold tabular-nums text-slate-500 dark:text-slate-400">
                  {tp.seen === 0 ? t('notStarted') : `${tp.masteryPct}%`}
                </span>
              </div>
              <ProgressBar
                value={tp.masteryPct}
                label={tc(tp.topic.title, locale)}
                tone={tp.mastered === tp.total && tp.total > 0 ? 'emerald' : 'indigo'}
              />
              <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {tp.seen}/{tp.total} {t('seen')} · {tp.mastered} {t('itemsMastered')}
              </div>
            </Card>
          ))}
        </div>

        <BadgeShelf badges={badges} />

        {(onOpenAccount || onOpenClasses) && (
          <div className="flex gap-2 pt-2">
            {onOpenAccount && (
              <Button variant="secondary" className="flex-1" onClick={onOpenAccount}>
                {t('account')}
              </Button>
            )}
            {onOpenClasses && (
              <Button variant="secondary" className="flex-1" onClick={onOpenClasses}>
                {t('myClasses')}
              </Button>
            )}
          </div>
        )}

        <div className="pt-2">
          <Button
            variant="ghost"
            className="w-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10"
            onClick={() => {
              if (window.confirm(t('resetConfirm'))) onReset()
            }}
          >
            {t('resetProgress')}
          </Button>
        </div>
      </div>
    </div>
  )
}
