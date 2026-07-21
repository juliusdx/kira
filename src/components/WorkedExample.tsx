import type { Lesson, Locale } from '../content/types'
import { t } from '../content/loader'
import { useKira } from '../app/KiraContext'
import { Button, Card } from './ui'

// The "I do" step of I-do / we-do / you-do (faded worked examples, Spec §2).
// Shown once per lesson before the first new item introduces the skill.
export function WorkedExample({
  lesson,
  locale,
  onContinue,
}: {
  lesson: Lesson
  locale: Locale
  onContinue: () => void
}) {
  const { t: tr } = useKira()
  const ex = lesson.worked_example
  return (
    <div className="animate-rise grid gap-5">
      <div className="text-center">
        <span className="text-xs font-bold tracking-widest text-indigo-500 uppercase">
          {tr('workedExample')}
        </span>
        <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
          {t(lesson.title, locale)}
        </h2>
      </div>
      <Card className="border-l-4 border-l-indigo-500">
        <p className="text-lg leading-relaxed text-slate-700 dark:text-slate-200">
          {ex ? t(ex.prompt, locale) : ''}
        </p>
      </Card>
      <Button onClick={onContinue}>{tr('gotIt')}</Button>
    </div>
  )
}
