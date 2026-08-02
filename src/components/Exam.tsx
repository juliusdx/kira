import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useKira } from '../app/KiraContext'
import { getItem, localizedOptions, t as tc, topicOf } from '../content/loader'
import type { ChoiceItem, Item } from '../content/types'
import {
  EXAM_MINUTES,
  EXAM_MS,
  buildPaper,
  scorePaper,
  type PaperQuestion,
} from '../exam/paper'
import { saveExamRun } from '../db/data'
import { Button, Card, FOCUS, ProgressBar } from './ui'
import { LocaleToggle } from './LocaleToggle'

// A mock Kertas 1: 40 multiple-choice questions in 75 minutes, no feedback
// until the paper is handed in.
//
// This is deliberately NOT SessionScreen with a flag. A practice session has a
// combo, a worked example on a new lesson, a self-explanation gate after an
// error-prone miss, and it re-queues what you got wrong — every one of those
// is either meaningless or actively wrong under exam conditions. Sharing the
// component would have meant threading a mode through all of it.
//
// It also does not use ItemRenderer. Choice items commit on tap, which is
// right for drilling with instant feedback and wrong here: in a real paper you
// can change your mind, and there is nothing to be immediate about.

type Stage = 'intro' | 'sitting' | 'done'

export function Exam({ onExit }: { onExit: () => void }) {
  const { t } = useKira()
  const [stage, setStage] = useState<Stage>('intro')
  const [seed, setSeed] = useState(0)
  const [startedAt, setStartedAt] = useState(0)

  const start = useCallback(() => {
    const now = Date.now()
    setSeed(now >>> 0)
    setStartedAt(now)
    setStage('sitting')
  }, [])

  if (stage === 'intro') return <ExamIntro onStart={start} onExit={onExit} />
  return (
    <ExamPaper
      seed={seed}
      startedAt={startedAt}
      done={stage === 'done'}
      onFinished={() => setStage('done')}
      onExit={onExit}
      key={seed}
    />
  )

  function ExamIntro({ onStart, onExit }: { onStart: () => void; onExit: () => void }) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-5 py-6">
        <header className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t('mockExam')}</h1>
          <Button variant="ghost" onClick={onExit}>
            {t('back')}
          </Button>
        </header>
        <Card>
          <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
            {t('mockExamIntro')}
          </p>
          <ul className="mt-3 flex flex-col gap-1.5 text-sm text-slate-600 dark:text-slate-300">
            <li>• {t('mockExamRule1').replace('{n}', String(EXAM_MINUTES))}</li>
            <li>• {t('mockExamRule2')}</li>
            <li>• {t('mockExamRule3')}</li>
          </ul>
        </Card>
        <Button onClick={onStart}>{t('mockExamStart')}</Button>
      </div>
    )
  }
}

/** mm:ss, and it never shows a negative clock. */
export function formatClock(msLeft: number): string {
  const s = Math.max(0, Math.floor(msLeft / 1000))
  return `${Math.floor(s / 60)}:${`${s % 60}`.padStart(2, '0')}`
}

function ExamPaper({
  seed,
  startedAt,
  done,
  onFinished,
  onExit,
}: {
  seed: number
  startedAt: number
  done: boolean
  onFinished: () => void
  onExit: () => void
}) {
  const { locale, t } = useKira()
  const paper = useMemo<PaperQuestion[]>(() => buildPaper(seed), [seed])
  const [answers, setAnswers] = useState<(string | null)[]>(() =>
    paper.map(() => null),
  )
  const [idx, setIdx] = useState(0)
  const [now, setNow] = useState(() => Date.now())
  const [confirming, setConfirming] = useState(false)
  const saved = useRef(false)

  // Dwell time per question, so an attempt still carries an honest msTaken
  // even though answers stay revisable to the end.
  const dwell = useRef<number[]>(paper.map(() => 0))
  const enteredAt = useRef(Date.now())

  const msLeft = EXAM_MS - (now - startedAt)

  const finish = useCallback(
    (autoSubmitted: boolean) => {
      // Belt and braces. Both routes in today reach this once on their own —
      // handing in unmounts the dialog before a second tap can land, and the
      // ticking interval is cleared as soon as `done` flips — so no test
      // exercises this line. It is kept for the case neither of those covers:
      // an effect double-invoked under StrictMode or a concurrent re-render,
      // where a second save would mean a duplicate run AND a second set of
      // attempts against the same 40 items.
      if (saved.current) return
      saved.current = true
      // bank the time spent on the question that is open when the paper ends
      dwell.current[idx] += Date.now() - enteredAt.current

      const finishedAt = Date.now()
      const graded = paper.map((q, i) => {
        const item = getItem(q.itemId) as Item | undefined
        const chosen = answers[i]
        return {
          item: item!,
          correct:
            !!item && chosen !== null && (item as ChoiceItem).answer === chosen,
          chosen,
          msTaken: Math.round(dwell.current[i]),
        }
      })
      const correct = graded.filter((g) => g.correct).length

      saveExamRun(
        {
          seed,
          startedAt,
          finishedAt,
          answers,
          score: correct,
          total: paper.length,
          autoSubmitted,
        },
        graded.filter((g) => g.item),
      ).catch((e) => console.error('[kira] saveExamRun failed', e))

      onFinished()
    },
    [answers, idx, paper, seed, startedAt, onFinished],
  )

  // One clock for the whole paper. Ticking every second is enough for mm:ss
  // and keeps this off the animation path entirely.
  useEffect(() => {
    if (done) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [done])

  useEffect(() => {
    if (!done && msLeft <= 0) finish(true)
  }, [done, msLeft, finish])

  const goTo = useCallback(
    (next: number) => {
      const at = Date.now()
      dwell.current[idx] += at - enteredAt.current
      enteredAt.current = at
      setIdx(next)
    },
    [idx],
  )

  if (done)
    return <ExamReview paper={paper} answers={answers} startedAt={startedAt} onExit={onExit} />

  const q = paper[idx]
  const item = getItem(q.itemId) as ChoiceItem | undefined
  const answered = answers.filter((a) => a !== null).length
  // Under five minutes the clock stops being background information.
  const urgent = msLeft <= 5 * 60_000

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col">
      <div className="safe-top flex items-center gap-3 px-4 pt-2 pb-3">
        <div
          role="timer"
          aria-label={t('timeLeft')}
          className={`shrink-0 rounded-xl px-2.5 py-1 text-sm font-bold tabular-nums ${
            urgent
              ? 'bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
              : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          {formatClock(msLeft)}
        </div>
        <ProgressBar
          value={(answered / paper.length) * 100}
          label={t('progress')}
          className="flex-1"
        />
        <div className="shrink-0 text-right text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400">
          {idx + 1}/{paper.length}
        </div>
        <LocaleToggle size="sm" />
      </div>

      <div className="flex-1 px-4 pb-4">
        {!item ? (
          <p className="text-sm text-slate-500">{t('itemMissing')}</p>
        ) : (
          <div key={q.itemId} className="grid gap-5">
            <h1 className="text-xl leading-snug font-bold text-slate-900 dark:text-white">
              {tc(item.prompt, locale)}
            </h1>
            <ExamChoices
              item={item}
              locale={locale}
              chosen={answers[idx]}
              onChoose={(v) =>
                setAnswers((a) => {
                  const next = [...a]
                  // Tapping the chosen option again clears it: a real paper
                  // lets you rub out an answer, and a wrong guess left in is
                  // marked the same as a blank anyway.
                  next[idx] = next[idx] === v ? null : v
                  return next
                })
              }
            />
          </div>
        )}
      </div>

      <div className="safe-bottom flex items-center gap-2 px-4 pb-4">
        <Button
          variant="secondary"
          className="flex-1"
          disabled={idx === 0}
          onClick={() => goTo(idx - 1)}
        >
          {t('previous')}
        </Button>
        {idx < paper.length - 1 ? (
          <Button className="flex-1" onClick={() => goTo(idx + 1)}>
            {t('nextQuestion')}
          </Button>
        ) : (
          <Button className="flex-1" onClick={() => setConfirming(true)}>
            {t('handIn')}
          </Button>
        )}
      </div>

      {/* Handing in early is the one irreversible action in the paper, and
          leaving questions blank is the thing worth warning about. */}
      {confirming && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-slate-900/40 p-4 sm:place-items-center">
          <Card className="w-full max-w-md">
            <h2 className="font-bold">{t('handIn')}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {answered === paper.length
                ? t('handInAll')
                : t('handInBlanks').replace(
                    '{n}',
                    String(paper.length - answered),
                  )}
            </p>
            <div className="mt-4 flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirming(false)}
              >
                {t('keepGoing')}
              </Button>
              <Button className="flex-1" onClick={() => finish(false)}>
                {t('handIn')}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

/**
 * Options as a selection, not a submission — no colours, nothing revealed.
 * `aria-pressed` rather than a radio group because tapping the chosen option
 * again clears it, which a radio cannot express.
 */
function ExamChoices({
  item,
  locale,
  chosen,
  onChoose,
}: {
  item: ChoiceItem
  locale: 'en' | 'ms'
  chosen: string | null
  onChoose: (value: string) => void
}) {
  const opts = localizedOptions(item.data.options, item.data.options_ms, locale)
  return (
    <div className="grid gap-3">
      {opts.map((o) => {
        const isChosen = chosen === o.value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={isChosen}
            onClick={() => onChoose(o.value)}
            className={`flex min-h-16 items-center gap-3 rounded-2xl px-5 text-left text-lg font-semibold transition-colors ${FOCUS} ${
              isChosen
                ? 'bg-indigo-50 text-indigo-900 ring-2 ring-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-100'
                : 'bg-white text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700'
            }`}
          >
            <span
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ${
                isChosen
                  ? 'border-indigo-500 bg-indigo-500'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
              aria-hidden
            >
              {isChosen && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            <span>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

/**
 * The result, and then the paper again with the answers shown.
 *
 * The score is not the useful part — the topic breakdown is, worst first, so
 * the sitting ends in "revise these two" rather than in a number.
 */
function ExamReview({
  paper,
  answers,
  startedAt,
  onExit,
}: {
  paper: PaperQuestion[]
  answers: (string | null)[]
  startedAt: number
  onExit: () => void
}) {
  const { locale, t } = useKira()
  const [open, setOpen] = useState<number | null>(null)

  const score = useMemo(
    () =>
      scorePaper(paper, answers, (itemId, answer) => {
        const item = getItem(itemId) as ChoiceItem | undefined
        return !!item && item.answer === answer
      }),
    [paper, answers],
  )
  const minutes = Math.max(1, Math.round((Date.now() - startedAt) / 60_000))

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('mockExamResult')}</h1>
        <Button variant="ghost" onClick={onExit}>
          {t('done')}
        </Button>
      </header>

      <Card>
        <div className="text-center">
          <div className="text-5xl font-bold tabular-nums text-slate-900 dark:text-white">
            {score.correct}
            <span className="text-2xl text-slate-400">/{score.total}</span>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {score.pct}% · {t('inMinutes').replace('{n}', String(minutes))}
          </p>
          {score.unanswered > 0 && (
            <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">
              {t('leftBlank').replace('{n}', String(score.unanswered))}
            </p>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="font-semibold">{t('byTopic')}</h2>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {t('mockExamRevise')}
        </p>
        <ul className="mt-3 flex flex-col gap-3">
          {score.byTopic.map((row) => {
            const title = topicOf(
              paper.find((q) => q.topicId === row.topicId)?.itemId ?? '',
            )?.title
            const pct = Math.round((row.correct / row.total) * 100)
            return (
              <li key={row.topicId}>
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate">
                    {title ? tc(title, locale) : row.topicId}
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                    {row.correct}/{row.total}
                  </span>
                </div>
                <ProgressBar
                  value={pct}
                  tone={pct >= 50 ? 'emerald' : 'indigo'}
                  label={title ? tc(title, locale) : row.topicId}
                  className="mt-1"
                />
              </li>
            )
          })}
        </ul>
      </Card>

      <h2 className="px-1 font-semibold">{t('everyQuestion')}</h2>
      {paper.map((q, i) => {
        const item = getItem(q.itemId) as ChoiceItem | undefined
        if (!item) return null
        const chosen = answers[i]
        const ok = chosen !== null && item.answer === chosen
        const opts = localizedOptions(item.data.options, item.data.options_ms, locale)
        const label = (v: string | null) =>
          opts.find((o) => o.value === v)?.label ?? v ?? t('blank')
        return (
          <Card key={q.itemId}>
            <button
              onClick={() => setOpen(open === i ? null : i)}
              aria-expanded={open === i}
              className={`w-full text-left ${FOCUS}`}
            >
              <div className="flex items-start gap-2">
                <span
                  className={`mt-0.5 shrink-0 text-sm font-bold tabular-nums ${
                    ok
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 text-sm text-slate-800 dark:text-slate-100">
                  {tc(item.prompt, locale)}
                </span>
              </div>
              <p className="mt-1 pl-6 text-xs text-slate-500 dark:text-slate-400">
                {ok ? t('correctLabel') : `${t('youPut')}: ${label(chosen)}`}
              </p>
            </button>
            {open === i && (
              <div className="mt-2 border-t border-slate-200 pt-2 pl-6 dark:border-slate-700">
                <p className="text-sm">
                  <span className="text-slate-500 dark:text-slate-400">
                    {t('theAnswer')}:{' '}
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {label(item.answer)}
                  </span>
                </p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {tc(item.explanation, locale)}
                </p>
              </div>
            )}
          </Card>
        )
      })}

      <p className="px-1 pb-4 text-center text-xs text-slate-400 dark:text-slate-500">
        {t('mockExamFooter').replace('{n}', String(EXAM_MINUTES))}
      </p>
    </div>
  )
}
