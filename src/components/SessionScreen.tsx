import { useCallback, useRef, useState } from 'react'
import type { ItemIndexEntry } from '../content/types'
import { lessonOf, t as tc } from '../content/loader'
import { useKira } from '../app/KiraContext'
import { grade, type Response } from '../grading/grade'
import { recordAttempt } from '../db/data'
import { ItemRenderer } from './items/ItemRenderer'
import { itemTypeLabel } from './items/shared'
import { WorkedExample } from './WorkedExample'
import { SelfExplain } from './SelfExplain'
import { Feedback } from './Feedback'
import { FOCUS, ProgressBar, TypeBadge } from './ui'

type Phase = 'worked' | 'answering' | 'reflect' | 'feedback'

export interface SessionResult {
  answered: number
  correct: number
}

export function SessionScreen({
  initialQueue,
  newIds,
  onQuit,
  onFinish,
}: {
  initialQueue: ItemIndexEntry[]
  newIds: Set<string>
  onQuit: () => void
  onFinish: (r: SessionResult) => void
}) {
  const { locale, t } = useKira()
  const [queue, setQueue] = useState<ItemIndexEntry[]>(initialQueue)
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>(() =>
    needsWorked(initialQueue[0], newIds) ? 'worked' : 'answering',
  )
  const [lastResponse, setLastResponse] = useState<Response | null>(null)
  const [lastCorrect, setLastCorrect] = useState(false)

  const shownLessons = useRef(new Set<string>())
  const requeued = useRef(new Map<string, number>())
  const startTime = useRef(nowMs())
  // First-attempt outcome per distinct item — the summary counts items, not
  // re-attempts, so a missed-then-corrected item stays one review at its
  // first-try accuracy.
  const firstResult = useRef(new Map<string, boolean>())
  // Fixed at session start so the progress meter never jumps backward when a
  // missed item is re-queued (re-queues are reinforcement beyond the plan).
  const plannedTotal = initialQueue.length

  const entry = queue[idx]
  const item = entry?.item
  const graded = phase === 'reflect' || phase === 'feedback'
  const isLast = idx >= queue.length - 1

  const goToIndex = useCallback(
    (i: number, q: ItemIndexEntry[]) => {
      const e = q[i]
      setIdx(i)
      setLastResponse(null)
      startTime.current = nowMs()
      setPhase(
        !shownLessons.current.has(e.lessonId) && needsWorked(e, newIds)
          ? 'worked'
          : 'answering',
      )
    },
    [newIds],
  )

  const handleSubmit = useCallback(
    (response: Response) => {
      if (phase !== 'answering' || !item) return
      const correct = grade(item, response)
      setLastResponse(response)
      setLastCorrect(correct)
      // Record only the FIRST attempt of each item toward the summary.
      if (!firstResult.current.has(item.id))
        firstResult.current.set(item.id, correct)

      const n = nowMs()
      recordAttempt(item, correct, response, n - startTime.current, n).catch(
        (e) => console.error('[kira] recordAttempt failed', e),
      )

      let nextQueue = queue
      // A missed item resurfaces once more this session (Leitner box 1).
      if (!correct && (requeued.current.get(item.id) ?? 0) < 1) {
        requeued.current.set(item.id, 1)
        nextQueue = [...queue, entry]
        setQueue(nextQueue)
      }

      const errorProne =
        item.type === 'debit_credit' ||
        item.type === 'spot_error' ||
        item.skill_tags.includes('debit-credit')
      setPhase(!correct && errorProne ? 'reflect' : 'feedback')
    },
    [phase, item, entry, queue],
  )

  const handleNext = useCallback(() => {
    if (idx + 1 < queue.length) goToIndex(idx + 1, queue)
    else {
      const results = [...firstResult.current.values()]
      onFinish({
        answered: results.length,
        correct: results.filter(Boolean).length,
      })
    }
  }, [idx, queue, goToIndex, onFinish])

  const dismissWorked = useCallback(() => {
    shownLessons.current.add(entry.lessonId)
    startTime.current = nowMs()
    setPhase('answering')
  }, [entry])

  if (!item) return null
  const lesson = lessonOf(item.id)
  // Monotonic against the planned total; re-queued items sit at 100%.
  const done = Math.min(idx, plannedTotal)
  const progress = plannedTotal ? (done / plannedTotal) * 100 : 0

  return (
    <div className="mx-auto flex min-h-full w-full max-w-xl flex-col">
      {/* Top bar */}
      <div className="safe-top flex items-center gap-3 px-4 pt-2 pb-3">
        <button
          onClick={onQuit}
          aria-label={t('closeSession')}
          className={`grid h-11 w-11 place-items-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 ${FOCUS}`}
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden>
            <path d="M10 8.6 6.4 5 5 6.4 8.6 10 5 13.6 6.4 15 10 11.4 13.6 15 15 13.6 11.4 10 15 6.4 13.6 5 10 8.6Z" />
          </svg>
        </button>
        <ProgressBar value={progress} label={t('progress')} className="flex-1" />
        <div className="w-12 text-right text-sm font-semibold tabular-nums text-slate-500 dark:text-slate-400">
          {Math.min(idx + 1, plannedTotal)}/{plannedTotal}
        </div>
      </div>

      <div className="flex-1 px-4 pb-4">
        {phase === 'worked' && lesson ? (
          <WorkedExample lesson={lesson} locale={locale} onContinue={dismissWorked} />
        ) : (
          <div key={`${item.id}-${idx}`} className="animate-rise grid gap-5">
            {/* Prompt */}
            <div className="grid gap-3">
              <TypeBadge label={itemTypeLabel(item, locale)} />
              <h1 className="text-xl leading-snug font-bold text-slate-900 dark:text-white">
                {tc(item.prompt, locale)}
              </h1>
            </div>

            <ItemRenderer
              item={item}
              locale={locale}
              graded={graded}
              lastResponse={lastResponse}
              onSubmit={handleSubmit}
            />

            {phase === 'reflect' && <SelfExplain onReveal={() => setPhase('feedback')} />}
            {phase === 'feedback' && (
              <Feedback
                item={item}
                correct={lastCorrect}
                locale={locale}
                isLast={isLast}
                onNext={handleNext}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function needsWorked(entry: ItemIndexEntry | undefined, newIds: Set<string>): boolean {
  if (!entry) return false
  const lesson = lessonOf(entry.item.id)
  return !!lesson?.worked_example && newIds.has(entry.item.id)
}

function nowMs(): number {
  return Date.now()
}
