/**
 * Consecutive-correct counter shown in the session top bar.
 *
 * Appears only from 2 onward — a "1x combo" is noise, and an always-visible
 * zero would nag after every miss. Intensity steps up at 5 and 10 so the
 * reward keeps meaning something without ever introducing time pressure.
 */
export function ComboPill({ combo }: { combo: number }) {
  if (combo < 2) return <div aria-hidden className="w-0" />

  const hot = combo >= 10
  const warm = combo >= 5
  const tone = hot
    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 ring-rose-500/30'
    : warm
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 ring-amber-500/30'
      : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ring-indigo-500/25'

  return (
    <div
      // key on the count so the pop animation replays on every increment
      key={combo}
      className={`animate-rise flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums ring-1 ${tone}`}
      role="status"
      aria-label={`${combo} correct in a row`}
    >
      <span aria-hidden>{hot ? '🔥' : warm ? '⚡' : '✨'}</span>
      {combo}
    </div>
  )
}
