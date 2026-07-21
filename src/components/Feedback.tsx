import type { Item, Locale } from '../content/types'
import { t } from '../content/loader'
import { useKira } from '../app/KiraContext'
import { Button } from './ui'
import { ResultIcon } from './items/shared'

/**
 * Instant right/wrong + a one-line why (Spec §2). For error-prone items
 * answered incorrectly, a self-explanation gate runs BEFORE this panel
 * (see SessionScreen) — so by here the learner has already reflected.
 */
export function Feedback({
  item,
  correct,
  locale,
  isLast,
  onNext,
}: {
  item: Item
  correct: boolean
  locale: Locale
  isLast: boolean
  onNext: () => void
}) {
  const { t: tr } = useKira()
  const tone = correct
    ? 'bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-100 dark:ring-emerald-500/30'
    : 'bg-rose-50 text-rose-900 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-100 dark:ring-rose-500/30'
  const iconTone = correct ? 'text-emerald-600' : 'text-rose-600'

  return (
    // Opaque, full-bleed backdrop: this panel sticks over long items (T-account,
    // statement build), so content must not show through it.
    <div className="animate-rise safe-bottom sticky bottom-0 -mx-4 grid gap-3 bg-slate-50 px-4 pt-3 dark:bg-slate-950">
      <div className={`rounded-2xl px-4 py-3 ring-1 ${tone}`}>
        <div className="flex items-center gap-2 text-base font-bold">
          <span className={iconTone}>
            <ResultIcon correct={correct} />
          </span>
          {correct ? tr('correct') : tr('incorrect')}
        </div>
        <p className="mt-1 text-sm leading-relaxed">{t(item.explanation, locale)}</p>
      </div>
      <Button variant={correct ? 'success' : 'primary'} onClick={onNext}>
        {isLast ? tr('finish') : tr('next')}
      </Button>
    </div>
  )
}
