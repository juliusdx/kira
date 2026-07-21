import { useKira } from '../app/KiraContext'
import { Button } from './ui'

// Self-explanation prompt (Spec §2). On error-prone misses we pause BEFORE
// revealing the explanation and ask the learner to retrieve the rule first —
// generating the reason beats reading it.
export function SelfExplain({ onReveal }: { onReveal: () => void }) {
  const { t } = useKira()
  return (
    <div className="animate-rise safe-bottom sticky bottom-0 grid gap-3 pt-3">
      <div className="rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:ring-amber-500/30">
        <div className="text-base font-bold text-amber-900 dark:text-amber-100">
          {t('whyTitle')}
        </div>
        <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-200/90">
          {t('whyBody')}
        </p>
      </div>
      <Button variant="secondary" onClick={onReveal}>
        {t('reveal')}
      </Button>
    </div>
  )
}
