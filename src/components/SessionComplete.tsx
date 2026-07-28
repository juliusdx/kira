import { useKira } from '../app/KiraContext'
import { t as tc } from '../content/loader'
import type { Badge } from '../app/badges'
import { Card } from './ui'
import { BigButton, Burst, CountUp, PlayCard } from './play'
import type { SessionResult } from './SessionScreen'

/**
 * The payoff screen. This is where the effort just spent turns into something
 * — so the numbers arrive rather than appear, and anything newly earned gets
 * its own moment instead of being a bullet in a list.
 */
export function SessionComplete({
  result,
  streak,
  freshBadges,
  dueLeft,
  onHome,
}: {
  result: SessionResult
  streak: number
  freshBadges: Badge[]
  /** reviews still waiting after this session — the honest "what's next" */
  dueLeft: number
  onHome: () => void
}) {
  const { locale, t } = useKira()
  const accuracy = result.answered
    ? Math.round((result.correct / result.answered) * 100)
    : 0
  const perfect = result.answered > 0 && result.correct === result.answered

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-5 px-5 py-6">
      <div className="animate-pop relative grid place-items-center gap-3 text-center">
        {/* A burst only when it was actually earned: everything right, or a
            badge. Celebrating an ordinary session cheapens the real ones. */}
        {(perfect || freshBadges.length > 0) && <Burst />}
        <div
          className={`grid h-20 w-20 place-items-center rounded-full ${
            perfect
              ? 'bg-amber-100 dark:bg-amber-500/20'
              : 'bg-emerald-100 dark:bg-emerald-500/20'
          }`}
        >
          {perfect ? (
            <span className="text-4xl" role="img" aria-hidden>
              🏆
            </span>
          ) : (
            <svg
              viewBox="0 0 24 24"
              className="h-11 w-11 text-emerald-600 dark:text-emerald-400"
              fill="currentColor"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M20.3 6.3a1 1 0 0 1 0 1.4l-9 9a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.4l3.3 3.29 8.3-8.29a1 1 0 0 1 1.4 0Z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">
          {perfect ? t('perfectSession') : t('sessionComplete')}
        </h1>
      </div>

      <Card className="w-full">
        <div className="flex divide-x divide-slate-200 dark:divide-slate-700">
          <div className="flex-1 text-center">
            <div className="text-3xl font-bold tabular-nums text-slate-900 dark:text-white">
              <CountUp value={result.answered} />
            </div>
            <div className="text-xs font-medium text-slate-500">{t('reviewedN')}</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              <CountUp value={accuracy} />%
            </div>
            <div className="text-xs font-medium text-slate-500">{t('accuracy')}</div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-3xl font-bold tabular-nums text-amber-500">
              🔥 <CountUp value={streak} />
            </div>
            <div className="text-xs font-medium text-slate-500">{t('streak')}</div>
          </div>
        </div>
        {result.bestCombo >= 2 && (
          <p className="mt-3 border-t border-slate-200 pt-3 text-center text-sm font-semibold text-indigo-600 dark:border-slate-700 dark:text-indigo-400">
            {t('bestRun')}: {result.bestCombo}
          </p>
        )}
      </Card>

      {freshBadges.map((b) => (
        <PlayCard key={b.id} glow className="animate-pop relative w-full overflow-hidden">
          <Burst count={10} />
          <p className="text-center text-xs font-bold tracking-wide text-amber-600 uppercase dark:text-amber-400">
            {t('badgeEarned')}
          </p>
          <div className="mt-3 flex flex-col items-center gap-1 text-center">
            <span className="text-5xl" role="img" aria-hidden>
              {b.emoji}
            </span>
            <div className="text-lg font-extrabold text-slate-900 dark:text-white">
              {tc(b.name, locale)}
            </div>
            <div className="text-sm text-slate-500 dark:text-slate-400">
              {tc(b.desc, locale)}
            </div>
          </div>
        </PlayCard>
      ))}

      {/* What happens next, honestly — not a nag to keep going forever. */}
      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        {dueLeft > 0
          ? t('stillDue').replace('{n}', String(dueLeft))
          : t('comeBackTomorrow')}
      </p>

      <BigButton onClick={onHome}>{t('backHome')}</BigButton>
    </div>
  )
}
