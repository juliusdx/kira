import { useKira } from '../app/KiraContext'
import { t as tc } from '../content/loader'
import type { Badge } from '../app/badges'
import { FOCUS, ProgressBar } from './ui'
import { Burst, CountUp, PlayCard, Ring } from './play'

/**
 * The collection, as its own screen rather than a card buried under seventeen
 * topic bars. Earned badges are shown large and in colour; locked ones keep
 * their exact requirement, because "7/10 mastered" is a next step and a row of
 * grey mysteries is not.
 */
export function Badges({ badges, onBack }: { badges: Badge[]; onBack: () => void }) {
  const { locale, t } = useKira()
  const earned = badges.filter((b) => b.earned)
  const locked = badges.filter((b) => !b.earned)
  const pct = badges.length ? Math.round((earned.length / badges.length) * 100) : 0

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
          {t('badges')}
        </h1>
      </header>

      <div className="flex-1 space-y-4 py-4">
        <div className="relative flex items-center justify-center py-2">
          {/* one burst when the whole set is complete — the only time it fires */}
          {earned.length === badges.length && badges.length > 0 && <Burst count={18} />}
          <Ring value={pct} size={148}>
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              <CountUp value={earned.length} />
              <span className="text-lg text-slate-400">/{badges.length}</span>
            </span>
            <span className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              {t('earned')}
            </span>
          </Ring>
        </div>

        {earned.length > 0 && (
          <PlayCard glow>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {t('earned')}
            </span>
            <ul className="mt-3 grid grid-cols-3 gap-3">
              {earned.map((b) => (
                <li
                  key={b.id}
                  className="animate-pop flex flex-col items-center gap-1.5 rounded-2xl bg-gradient-to-br from-amber-50 to-white p-3 text-center ring-1 ring-amber-200 dark:from-amber-500/10 dark:to-slate-800/40 dark:ring-amber-500/25"
                >
                  <span className="text-4xl" role="img" aria-hidden>
                    {b.emoji}
                  </span>
                  <span className="text-xs leading-tight font-bold text-slate-800 dark:text-slate-100">
                    {tc(b.name, locale)}
                  </span>
                  <span className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                    {tc(b.desc, locale)}
                  </span>
                </li>
              ))}
            </ul>
          </PlayCard>
        )}

        {locked.length > 0 && (
          <PlayCard>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
              {t('locked')}
            </span>
            <ul className="mt-3 grid gap-3.5">
              {locked.map((b) => (
                // min-w-0: a grid item defaults to min-width:auto, and the
                // `truncate` inside sets white-space:nowrap — so without this
                // the row's min-content is the full badge name and the whole
                // card overflows the screen instead of ellipsising.
                <li key={b.id} className="flex min-w-0 items-center gap-3">
                  <span className="text-2xl opacity-25 grayscale" role="img" aria-hidden>
                    {b.emoji}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {tc(b.name, locale)}
                      </span>
                      {b.need != null && (
                        <span className="shrink-0 text-xs font-bold tabular-nums text-indigo-600 dark:text-indigo-400">
                          {b.have}/{b.need}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                      {tc(b.desc, locale)}
                    </p>
                    {b.need != null && (
                      <ProgressBar
                        value={((b.have ?? 0) / b.need) * 100}
                        label={tc(b.name, locale)}
                        className="mt-1.5 h-1.5"
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </PlayCard>
        )}
      </div>
    </div>
  )
}
