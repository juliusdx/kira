import { useCallback, useEffect, useState } from 'react'
import { ALL_ENTRIES } from '../content/loader'
import type { ReviewState } from '../scheduler/scheduler'
import {
  bumpStreak,
  getStreak,
  loadAttempts,
  loadReviewMap,
  resetAllProgress,
} from '../db/data'
import { computeBadges, newlyEarned, type Badge } from './badges'
import { buildQueue, type BuiltQueue } from '../session/buildQueue'
import { syncNow, watchConnectivity } from '../sync/sync'
import { SYNC_ENABLED } from '../sync/client'
import { computeProgress } from './progress'
import { useKira } from './KiraContext'
import { Home } from '../components/Home'
import { Progress } from '../components/Progress'
import { SessionScreen, type SessionResult } from '../components/SessionScreen'
import { SessionComplete } from '../components/SessionComplete'
import { Account } from '../components/Account'
import { Classes } from '../components/Classes'
import { Exam } from '../components/Exam'
import { Badges } from '../components/Badges'
import { ProfileSheet } from '../components/ProfileSheet'
import { getProfile, pullProfile, type LocalProfile } from './profile'
import { ensureSession } from '../sync/client'

type Screen =
  | 'home'
  | 'session'
  | 'complete'
  | 'progress'
  | 'account'
  | 'classes'
  | 'badges'
  | 'profile'
  | 'exam'

export function App() {
  const { ready } = useKira()
  const [reviewMap, setReviewMap] = useState<Map<string, ReviewState> | null>(null)
  const [streak, setStreak] = useState(0)
  const [badges, setBadges] = useState<Badge[]>([])
  // badges earned by the session just finished, for the celebration screen
  const [freshBadges, setFreshBadges] = useState<Badge[]>([])
  const [screen, setScreen] = useState<Screen>('home')
  const [session, setSession] = useState<BuiltQueue | null>(null)
  const [result, setResult] = useState<SessionResult | null>(null)
  const [profile, setProfile] = useState<LocalProfile>({ name: null, avatar: null })
  // Seeds the derived avatar so a learner has a distinct face before they
  // ever pick one. Null (sync off / offline) simply falls back to the default.
  const [userId, setUserId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const now = Date.now()
    const [map, s, attempts] = await Promise.all([
      loadReviewMap(),
      getStreak(now),
      loadAttempts(),
    ])
    setReviewMap(map)
    setStreak(s)
    const next = computeBadges(map, attempts, now)
    setBadges(next)
    return next
  }, [])

  useEffect(() => {
    void reload()
    void getProfile().then(setProfile)
  }, [reload])

  useEffect(() => {
    if (!SYNC_ENABLED) return
    void ensureSession().then(async (id) => {
      setUserId(id)
      // name + face follow the account, so a new device is not anonymous
      setProfile(await pullProfile())
    })
  }, [])

  // Pull anything this device missed, then keep syncing when we come back
  // online. No-op unless Supabase credentials are configured.
  useEffect(() => {
    if (!SYNC_ENABLED) return
    void syncNow().then((r) => {
      if (r.pulledReviews) void reload()
    })
    return watchConnectivity()
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
      // `badges` still holds the pre-session snapshot at this point, so the
      // diff is exactly what this session earned.
      const before = badges
      const after = await reload()
      setFreshBadges(newlyEarned(before, after))
      setResult(r)
      setSession(null)
      setScreen('complete')
      // Push this session's work; failure is non-fatal (retried next launch).
      if (SYNC_ENABLED) void syncNow()
    },
    [reload, badges],
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
          badges={badges}
          name={profile.name}
          avatar={profile.avatar}
          userId={userId}
          onStart={startSession}
          onOpenProgress={() => setScreen('progress')}
          onOpenBadges={() => setScreen('badges')}
          onOpenExam={() => setScreen('exam')}
          onEditProfile={() => setScreen('profile')}
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
          freshBadges={freshBadges}
          dueLeft={summary.dueCount}
          onHome={() => setScreen('home')}
        />
      )}

      {screen === 'progress' && (
        <Progress
          summary={summary}
          onBack={() => setScreen('home')}
          onReset={doReset}
          onOpenAccount={SYNC_ENABLED ? () => setScreen('account') : undefined}
          onOpenClasses={SYNC_ENABLED ? () => setScreen('classes') : undefined}
        />
      )}

      {screen === 'account' && (
        <Account
          onBack={() => setScreen('progress')}
          // signing in as a different account changes whose data we hold:
          // pull it down and re-render from the merged result.
          onChanged={() => {
            void syncNow().then(reload)
          }}
        />
      )}

      {screen === 'classes' && <Classes onBack={() => setScreen('progress')} />}

      {/* Leaving the exam reloads home so a mock's effect on the schedule and
          the badges is visible immediately — it wrote real attempts. */}
      {screen === 'exam' && (
        <Exam
          onExit={() => {
            setScreen('home')
            void reload()
          }}
        />
      )}

      {screen === 'badges' && (
        <Badges badges={badges} onBack={() => setScreen('home')} />
      )}

      {screen === 'profile' && (
        <ProfileSheet
          name={profile.name}
          avatar={profile.avatar}
          userId={userId}
          onSaved={setProfile}
          onClose={() => setScreen('home')}
        />
      )}
    </div>
  )
}
