import type { ProgressSummary } from '../app/progress'
import type { Badge } from '../app/badges'
import { useKira } from '../app/KiraContext'
import { EXAM_MINUTES } from '../exam/paper'
import { t as tc } from '../content/loader'
import { Card, FOCUS } from './ui'
import { Avatar, BigButton, CountUp, PlayCard, Ring } from './play'
import { LocaleToggle } from './LocaleToggle'

/**
 * The learner's home. It answers, in order: who am I, how far have I come,
 * what is there to do, and what am I close to earning.
 *
 * It used to answer only the third of those — three counters and a button.
 */
export function Home({
  summary,
  streak,
  badges,
  name,
  avatar,
  userId,
  onStart,
  onOpenProgress,
  onOpenBadges,
  onOpenExam,
  onEditProfile,
}: {
  summary: ProgressSummary
  streak: number
  badges: Badge[]
  name: string | null
  avatar: string | null
  userId: string | null
  onStart: () => void
  onOpenProgress: () => void
  onOpenBadges: () => void
  onOpenExam: () => void
  onEditProfile: () => void
}) {
  const { locale, t } = useKira()
  const nothingToDo = summary.dueCount === 0 && summary.newCount === 0
  const startLabel = summary.seenCount > 0 ? t('continue') : t('start')

  const earned = badges.filter((b) => b.earned)
  // The closest unearned badge with a countable target — a concrete next step
  // beats a shelf of mysteries.
  const nextBadge = badges
    .filter((b) => !b.earned && b.need != null && b.need > 0)
    .sort((a, b) => (b.have ?? 0) / b.need! - (a.have ?? 0) / a.need!)[0]

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col px-5">
      <header className="safe-top flex items-center justify-between gap-3 pt-3 pb-2">
        <button
          onClick={onEditProfile}
          className={`-m-1 flex min-w-0 items-center gap-2.5 rounded-2xl p-1 text-left ${FOCUS}`}
          aria-label={t('editProfile')}
        >
          <Avatar seed={userId} chosen={avatar} />
          {/* With no name set this must read as an invitation, not as a claim
              that the learner is called "Kira". */}
          {name ? (
            <span className="min-w-0">
              <span className="block truncate text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                {name}
              </span>
              <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                {t('editProfile')}
              </span>
            </span>
          ) : (
            <span className="truncate text-base font-bold text-indigo-600 dark:text-indigo-400">
              {t('addYourName')}
            </span>
          )}
        </button>
        <LocaleToggle />
      </header>

      <div className="flex flex-1 flex-col justify-center gap-5 py-4">
        {/* Where am I */}
        <div className="flex items-center gap-5">
          <Ring value={summary.overallPct}>
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              <CountUp value={summary.overallPct} />
              <span className="text-lg">%</span>
            </span>
            <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              {t('mastery')}
            </span>
          </Ring>

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Stat
              emoji="📚"
              value={summary.dueCount}
              label={t('dueToday')}
              tone="text-indigo-600 dark:text-indigo-400"
            />
            <Stat
              emoji="✨"
              value={summary.newCount}
              label={t('newToday')}
              tone="text-slate-900 dark:text-white"
            />
            <Stat emoji="🔥" value={streak} label={t('streak')} tone="text-amber-500" />
          </div>
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
          <BigButton onClick={onStart} className="animate-breathe">
            {startLabel}
          </BigButton>
        )}

        {/* What am I close to */}
        <button
          onClick={onOpenBadges}
          className={`rounded-3xl text-left ${FOCUS}`}
          aria-label={t('badges')}
        >
          <PlayCard glow={earned.length > 0}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-slate-900 dark:text-white">{t('badges')}</span>
              <span className="text-sm font-bold tabular-nums text-slate-500 dark:text-slate-400">
                {earned.length}/{badges.length} →
              </span>
            </div>

            {earned.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {earned.slice(-8).map((b) => (
                  <span
                    key={b.id}
                    className="text-2xl"
                    role="img"
                    aria-label={tc(b.name, locale)}
                  >
                    {b.emoji}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                {t('noBadgesYet')}
              </p>
            )}

            {nextBadge && (
              <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-lg opacity-40 grayscale" role="img" aria-hidden>
                    {nextBadge.emoji}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-600 dark:text-slate-300">
                    {tc(nextBadge.name, locale)}
                  </span>
                  <span className="shrink-0 text-xs font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                    {(nextBadge.need ?? 0) - (nextBadge.have ?? 0)} {t('toGo')}
                  </span>
                </div>
              </div>
            )}
          </PlayCard>
        </button>

        {/* Sits BELOW the daily session on purpose. A mock is worth sitting
            once in a while; practice is what to do today, and putting the exam
            first would invite grinding papers instead of reviewing. */}
        <button
          onClick={onOpenExam}
          className={`flex w-full items-center gap-3 rounded-2xl bg-white px-4 py-3 text-left ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800/60 dark:ring-slate-700 dark:hover:bg-slate-800 ${FOCUS}`}
        >
          <span className="text-2xl" aria-hidden>📝</span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-slate-900 dark:text-white">
              {t('mockExam')}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">
              {t('mockExamHint').replace('{n}', String(EXAM_MINUTES))}
            </span>
          </span>
          <span className="shrink-0 text-slate-400" aria-hidden>→</span>
        </button>

        <button
          onClick={onOpenProgress}
          className={`mx-auto rounded-lg px-2 py-1 text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400 ${FOCUS}`}
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

function Stat({
  emoji,
  value,
  label,
  tone,
}: {
  emoji: string
  value: number
  label: string
  tone: string
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-white px-3 py-2 ring-1 ring-slate-200/70 dark:bg-slate-800/60 dark:ring-slate-700/70">
      <span className="text-lg" role="img" aria-hidden>
        {emoji}
      </span>
      <span className={`text-xl font-extrabold tabular-nums ${tone}`}>
        <CountUp value={value} />
      </span>
      <span className="min-w-0 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
        {label}
      </span>
    </div>
  )
}
