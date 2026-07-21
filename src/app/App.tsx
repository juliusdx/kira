import { useCallback, useEffect, useState } from 'react'
import { ALL_ENTRIES } from '../content/loader'
import type { ReviewState } from '../scheduler/scheduler'
import {
  bumpStreak,
  getStreak,
  loadReviewMap,
  resetAllProgress,
} from '../db/data'
import { buildQueue, type BuiltQueue } from '../session/buildQueue'
import { computeProgress } from './progress'
import { useKira } from './KiraContext'
import { Home } from '../components/Home'
import { Progress } from '../components/Progress'
import { SessionScreen, type SessionResult } from '../components/SessionScreen'
import { SessionComplete } from '../components/SessionComplete'

type Screen = 'home' | 'session' | 'complete' | 'progress'

export function App() {
  const { ready } = useKira()
  const [reviewMap, setReviewMap] = useState<Map<string, ReviewState> | null>(null)
  const [streak, setStreak] = useState(0)
  const [screen, setScreen] = useState<Screen>('home')
  const [session, setSession] = useState<BuiltQueue | null>(null)
  const [result, setResult] = useState<SessionResult | null>(null)

  const reload = useCallback(async () => {
    const now = Date.now()
    const [map, s] = await Promise.all([loadReviewMap(), getStreak(now)])
    setReviewMap(map)
    setStreak(s)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const startSession = useCallback(() => {
    if (!reviewMap) return
    const built = buildQueue(ALL_ENTRIES, reviewMap, Date.now())
    if (!built.queue.length) return
    setSession(built)
    setScreen('session')
  }, [reviewMap])

  const finishSession = useCallback(
    async (r: SessionResult) => {
      if (r.answered > 0) await bumpStreak(Date.now())
      await reload()
      setResult(r)
      setSession(null)
      setScreen('complete')
    },
    [reload],
  )

  const quitSession = useCallback(() => {
    void reload()
    setSession(null)
    setScreen('home')
  }, [reload])

  const doReset = useCallback(async () => {
    await resetAllProgress()
    await reload()
    setScreen('home')
  }, [reload])

  const shell =
    'min-h-full bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100'

  if (!ready || !reviewMap) {
    return (
      <div className={`grid min-h-full place-items-center ${shell}`}>
        <img
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt="Kira"
          className="h-16 w-16 animate-pulse rounded-2xl motion-reduce:animate-none"
        />
      </div>
    )
  }

  const summary = computeProgress(reviewMap, Date.now())

  return (
    <div className={shell}>
      {screen === 'home' && (
        <Home
          summary={summary}
          streak={streak}
          onStart={startSession}
          onOpenProgress={() => setScreen('progress')}
        />
      )}

      {screen === 'session' && session && (
        <SessionScreen
          initialQueue={session.queue}
          newIds={session.newIds}
          onQuit={quitSession}
          onFinish={finishSession}
        />
      )}

      {screen === 'complete' && result && (
        <SessionComplete
          result={result}
          streak={streak}
          onHome={() => setScreen('home')}
        />
      )}

      {screen === 'progress' && (
        <Progress
          summary={summary}
          onBack={() => setScreen('home')}
          onReset={doReset}
        />
      )}
    </div>
  )
}
