import { useCallback, useEffect, useRef, useState } from 'react'
import { useKira } from '../app/KiraContext'
import { Button, Card, FOCUS, ProgressBar } from './ui'
import {
  createClass,
  getClassRoster,
  getLearnerDetail,
  joinClass,
  leaveClass,
  listJoinedClasses,
  listMyClasses,
  removeMember,
  rotateJoinCode,
  getClassActivity,
  getClassWeakSpots,
  type ClassRow,
  type ClassWeakSpot,
  type LearnerDetail,
  type LearnerSummary,
} from '../sync/classes'
import { skillLabel, t as tc } from '../content/loader'
import type { UIKey } from '../i18n/strings'
import { getIdentity } from '../sync/identity'
import { copyText } from '../lib/clipboard'
import { buildAuthoringBrief, buildBriefBundle } from '../lib/authoringBrief'
import { describeChosen } from '../lib/chosenAnswer'
import { getItemNotes, saveItemNote, NOTE_MAX, type SaveResult } from '../sync/notes'
import { friendlyClassError, isOffline } from '../sync/classErrors'
import { nextAction, TONE_RANK } from '../app/nextAction'
import { Leaderboard } from './Leaderboard'
import { MyNotes } from './MyNotes'
import { ItemPreview } from './ItemPreview'
import { Avatar } from './play'
import type { RecentMiss } from '../sync/classes'

// Teacher dashboard + learner join flow. All reads are RLS-gated server-side:
// a teacher only ever receives rows for learners who joined their class.

const input =
  'min-h-12 w-full rounded-2xl bg-white px-4 text-base ring-1 ring-slate-200 outline-none placeholder:text-slate-400 dark:bg-slate-800 dark:text-white dark:ring-slate-700'

/** ABCD-EFGH-IJKL — the stored code has no separators. */
function formatCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-')
}

/**
 * Turn whatever the network threw into something a parent can act on, and keep
 * the raw text when we do not recognise it — this screen has no local fallback
 * to compare against, so a swallowed error would be invisible.
 */
function useErrorText() {
  const { t } = useKira()
  // The returned function must be referentially STABLE. It is a dependency of
  // the load callbacks below, which are in turn dependencies of the effects
  // that fetch — and `useKira()` hands back a fresh `t` on every render. With
  // `[t]` here, every render produced a new fetch callback, so the mount
  // effect became an every-render effect: a reload loop against the RPC that
  // also stomped the teacher's just-saved note state on each pass.
  const latest = useRef(t)
  latest.current = t
  return useCallback((e: unknown): string => {
    const raw = e instanceof Error ? e.message : String(e)
    const friendly = friendlyClassError(raw)
    const say = latest.current
    return friendly.raw ? `${say(friendly.key)} (${friendly.raw})` : say(friendly.key)
  }, [])
}

/**
 * "as of 14:32" under a report. A progress report with no timestamp invites
 * the reader to believe it is live; this one is a snapshot taken when the
 * screen opened, and a parent watching their child practise in the next room
 * needs to know which.
 */
export function freshness(
  loadedAt: number | null,
  t: (k: UIKey) => string,
  now: number = Date.now(),
): string {
  if (loadedAt === null) return ''
  const mins = Math.floor((now - loadedAt) / 60_000)
  const when =
    mins < 1
      ? t('justNow')
      : mins < 60
        ? t('minutesAgo').replace('{n}', String(mins))
        : t('hoursAgo').replace('{n}', String(Math.floor(mins / 60)))
  return t('asOf').replace('{t}', when)
}

/**
 * A report header: what you are looking at, when it was taken, and a way to
 * take it again. Every teacher screen loaded once on mount and then sat there
 * looking authoritative for as long as it was open.
 */
function ReportHeader({
  loadedAt,
  busy,
  onRefresh,
}: {
  loadedAt: number | null
  busy: boolean
  onRefresh: () => void
}) {
  const { t } = useKira()
  const [, tick] = useState(0)
  // Re-render once a minute so "as of just now" does not stay "just now" for
  // an hour. Cheap: one setState on a screen with no animation.
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex items-baseline justify-between gap-2 px-1">
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {busy ? t('refreshing') : freshness(loadedAt, t)}
      </p>
      <button
        onClick={onRefresh}
        disabled={busy}
        className={`shrink-0 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10 ${FOCUS}`}
      >
        {t('refresh')}
      </button>
    </div>
  )
}

/**
 * The one line on a roster card that says what to DO. Everything else on the
 * card is a state; this is the only part a parent can act on tonight, so it
 * sits directly under the name and carries the only colour on the card.
 */
function ActionLine({ learner }: { learner: LearnerSummary }) {
  const { t } = useKira()
  const action = nextAction(learner)
  const tone =
    action.tone === 'urgent'
      ? 'text-rose-600 dark:text-rose-400'
      : action.tone === 'attention'
        ? 'text-indigo-600 dark:text-indigo-400'
        : 'text-slate-500 dark:text-slate-400'
  return (
    <div className="mt-1">
      <p className={`text-sm font-semibold ${tone}`}>
        {t(action.key).replace('{n}', String(action.n ?? ''))}
      </p>
      {/* The one case where the cause is more useful than the task. */}
      {action.key === 'actNotStarted' && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {t('actNotStartedHint')}
        </p>
      )}
    </div>
  )
}

/**
 * Seven dots: did they come back?
 *
 * Mastery and accuracy both look healthy on an account nobody has opened in a
 * fortnight. This is the number spaced repetition actually depends on, and it
 * is the one the roster never showed.
 */
function PracticeStrip({ days }: { days: boolean[] }) {
  const { t } = useKira()
  const n = days.filter(Boolean).length
  return (
    <div className="mt-2 flex items-center gap-2">
      <div
        className="flex gap-1"
        role="img"
        aria-label={t('daysPractised').replace('{n}', String(n))}
      >
        {days.map((on, i) => (
          <span
            key={i}
            className={`h-2 w-2 rounded-full ${
              on ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
            }`}
          />
        ))}
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {t('daysPractised').replace('{n}', String(n))}
      </span>
    </div>
  )
}

/**
 * What the whole class is weakest at.
 *
 * Per-learner drilling stops scaling at about one child: a teacher with a class
 * needs the topic to reteach, not six separate reading exercises. The learner
 * COUNT is the part that matters — one learner missing an item six times is a
 * conversation with that learner, four learners missing it once each is a
 * lesson, and a percentage cannot tell them apart.
 */
function ClassWeakSpots({ spots }: { spots: ClassWeakSpot[] | null }) {
  const { t, locale } = useKira()
  if (spots === null) return null
  return (
    <Card>
      <h2 className="font-semibold">{t('classWeakSpots')}</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        {t('classWeakSpotsHint')}
      </p>
      {spots.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {t('noClassWeakSpots')}
        </p>
      ) : (
        <ul className="mt-2 flex flex-col gap-2">
          {spots.map((s) => (
            <li key={s.tag}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">
                  {skillLabel(s.tag, locale)}
                </span>
                <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                  {s.wrong}/{s.attempts} {t('wrongLabel')}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {s.learners > 1
                  ? t('learnersMissed').replace('{n}', String(s.learners))
                  : t('oneLearnerMissed')}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

/** Shown while the browser reports no connection, on the one screen that needs it. */
function OfflineBanner() {
  const { t } = useKira()
  const [offline, setOffline] = useState(isOffline())
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  if (!offline) return null
  return (
    <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
      {t('offlineBanner')}
    </p>
  )
}

/**
 * Localized "when". This renders on every roster card, so leaving it in
 * English put hardcoded English in front of a BM-default audience.
 */
export function relativeTime(
  iso: string | null,
  t: (k: UIKey) => string,
  now: number = Date.now(),
): string {
  if (!iso) return t('never')
  const days = Math.floor((now - Date.parse(iso)) / 86_400_000)
  if (days <= 0) return t('today')
  if (days === 1) return t('yesterday')
  if (days < 30) return t('daysAgo').replace('{n}', String(days))
  return t('monthsAgo').replace('{n}', String(Math.floor(days / 30)))
}

export function Classes({ onBack }: { onBack: () => void }) {
  const { t } = useKira()
  const errorText = useErrorText()
  const [mine, setMine] = useState<ClassRow[]>([])
  const [joined, setJoined] = useState<ClassRow[]>([])
  const [open, setOpen] = useState<ClassRow | null>(null)
  const [hasEmail, setHasEmail] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [showNotes, setShowNotes] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [m, j, id] = await Promise.all([
        listMyClasses(),
        listJoinedClasses(),
        getIdentity(),
      ])
      setMine(m)
      setJoined(j)
      setHasEmail(Boolean(id?.email))
      setError(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setLoading(false)
    }
  }, [errorText])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const doJoin = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await joinClass(code)
      setCode('')
      await refresh()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }, [code, refresh, errorText])

  const doCreate = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await createClass(newName)
      setNewName('')
      await refresh()
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }, [newName, refresh, errorText])

  if (open) {
    return <Roster cls={open} onBack={() => { setOpen(null); void refresh() }} />
  }
  if (showNotes) return <MyNotes onBack={() => setShowNotes(false)} />

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('myClasses')}</h1>
        <Button variant="ghost" onClick={onBack}>
          {t('back')}
        </Button>
      </header>

      {error && (
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
      )}
      {loading && <p className="text-sm text-slate-500">{t('loading')}</p>}

      {/* learner: join a class */}
      <Card>
        <h2 className="font-semibold">{t('joinClass')}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('enterJoinCode')}
        </p>
        <div className="mt-3 flex gap-2">
          <input
            aria-label={t('joinCode')}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            className={`${input} ${FOCUS} font-mono tracking-widest`}
            placeholder="ABCD-EFGH-IJKL"
          />
          <Button disabled={busy || code.length < 12} onClick={() => void doJoin()}>
            {t('join')}
          </Button>
        </div>
      </Card>

      {joined.length > 0 && (
        <>
          {joined.map((c) => (
            <div key={c.id} className="grid gap-2">
              <div className="flex items-baseline justify-between gap-2 px-1">
                <h2 className="truncate text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {c.name}
                </h2>
                <button
                  className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 ${FOCUS}`}
                  onClick={async () => {
                    if (!confirm(t('leaveConfirm'))) return
                    try {
                      await leaveClass(c.id)
                      await refresh()
                    } catch (e) {
                      setError(errorText(e))
                    }
                  }}
                >
                  {t('leaveClass')}
                </button>
              </div>
              <Leaderboard classId={c.id} />
            </div>
          ))}
        </>
      )}

      {/* teacher: create + open classes */}
      <Card>
        <h2 className="font-semibold">{t('teacherView')}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('parentHint')}
        </p>
        {!hasEmail && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            {t('needAccountForClass')}
          </p>
        )}
        <div className="mt-3 flex gap-2">
          <input
            aria-label={t('className')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className={`${input} ${FOCUS}`}
            placeholder={t('className')}
          />
          <Button
            variant="secondary"
            disabled={busy || !newName.trim()}
            onClick={() => void doCreate()}
          >
            {t('create')}
          </Button>
        </div>

        {mine.length > 0 && (
          <button
            onClick={() => setShowNotes(true)}
            className={`mt-3 w-full rounded-xl px-2 py-1.5 text-left text-sm font-semibold text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10 ${FOCUS}`}
          >
            {t('myNotes')} →
          </button>
        )}

        {mine.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2">
            {mine.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setOpen(c)}
                  className={`w-full rounded-2xl bg-slate-50 px-4 py-3 text-left ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:ring-slate-700 dark:hover:bg-slate-700 ${FOCUS}`}
                >
                  <span className="font-semibold">{c.name}</span>
                  <span className="mt-0.5 block font-mono text-xs text-slate-500 dark:text-slate-400">
                    {formatCode(c.join_code)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Roster({ cls, onBack }: { cls: ClassRow; onBack: () => void }) {
  const { t } = useKira()
  const errorText = useErrorText()
  const [rows, setRows] = useState<LearnerSummary[] | null>(null)
  const [code, setCode] = useState(cls.join_code)
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no')
  const [error, setError] = useState<string | null>(null)
  const [detailOf, setDetailOf] = useState<LearnerSummary | null>(null)
  const [loadedAt, setLoadedAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [activity, setActivity] = useState<Map<string, boolean[]>>(new Map())
  const [weakSpots, setWeakSpots] = useState<ClassWeakSpot[] | null>(null)

  const refresh = useCallback(async () => {
    setBusy(true)
    try {
      // The roster is the report; the other two are additions to it. They come
      // from 0009, which may not be applied yet, so each swallows its own
      // absence rather than taking the roster down with it.
      const [roster, days, spots] = await Promise.all([
        getClassRoster(cls.id),
        getClassActivity(cls.id),
        getClassWeakSpots(cls.id),
      ])
      setRows(roster)
      setActivity(days)
      setWeakSpots(days.size === 0 && spots.length === 0 ? null : spots)
      setLoadedAt(Date.now())
      setError(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }, [cls.id, errorText])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (detailOf)
    return (
      <LearnerDetailView
        cls={cls}
        learner={detailOf}
        // Re-read the roster on the way back: the teacher has just been looking
        // at a detail screen that may itself have been refreshed, and two
        // disagreeing snapshots of the same learner is worse than one old one.
        onBack={() => {
          setDetailOf(null)
          void refresh()
        }}
      />
    )

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="truncate text-xl font-bold">{cls.name}</h1>
        <Button variant="ghost" onClick={onBack}>
          {t('back')}
        </Button>
      </header>

      <OfflineBanner />
      <ReportHeader loadedAt={loadedAt} busy={busy} onRefresh={() => void refresh()} />

      <Card>
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('shareCode')}</p>
        {/* select-all so a tap selects the whole code when copying fails */}
        <p className="mt-1 font-mono text-lg font-bold tracking-widest select-all">
          {formatCode(code)}
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={async () => {
              // Only claim success if the clipboard actually took it —
              // otherwise the user pastes whatever was already there.
              const ok = await copyText(formatCode(code))
              setCopied(ok ? 'yes' : 'failed')
              if (ok) setTimeout(() => setCopied('no'), 1500)
            }}
          >
            {copied === 'yes' ? t('copied') : t('shareCode')}
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              if (!confirm(t('rotateConfirm'))) return
              try {
                setCode(await rotateJoinCode(cls.id))
              } catch (e) {
                setError(errorText(e))
              }
            }}
          >
            {t('newCode')}
          </Button>
        </div>
        {copied === 'failed' && (
          <p className="mt-2 text-sm font-medium text-amber-600 dark:text-amber-400">
            {t('copyFailed')}
          </p>
        )}
      </Card>

      {error && (
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
      )}

      <Leaderboard classId={cls.id} />

      <ClassWeakSpots spots={weakSpots} />

      <h2 className="px-1 font-semibold">{t('learners')}</h2>

      {rows === null && <p className="px-1 text-sm text-slate-500">{t('loading')}</p>}
      {rows?.length === 0 && (
        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('noLearners')}</p>
        </Card>
      )}

      {/* Whoever needs something comes first. The server orders by last-active,
          which is a reasonable default and the wrong one here: the learner who
          has gone quiet for nine days is exactly the one that ordering buries.
          Ties keep the server's order, so it stays stable between refreshes. */}
      {rows
        ?.map((r, i) => ({ r, i, rank: TONE_RANK[nextAction(r).tone] }))
        .sort((a, b) => a.rank - b.rank || a.i - b.i)
        .map(({ r }) => (
        <Card key={r.userId}>
          <div className="flex items-center gap-2.5">
            <Avatar seed={r.userId} chosen={r.avatar} size="sm" />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {r.displayName ?? `${r.userId.slice(0, 8)}…`}
            </span>
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
              {relativeTime(r.lastActiveAt, t)}
            </span>
          </div>

          <ActionLine learner={r} />
          {activity.get(r.userId)?.length ? (
            <PracticeStrip days={activity.get(r.userId)!} />
          ) : null}

          <div className="mt-3 flex items-center gap-2">
            <ProgressBar value={r.masteryPct} label={t('mastery')} className="flex-1" />
            <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums">
              {r.masteryPct}%
            </span>
          </div>

          <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              [r.seen, t('seen')],
              [r.mastered, t('itemsMastered')],
              [r.due, t('dueToday')],
              [r.accuracyPct === null ? '—' : `${r.accuracyPct}%`, t('accuracy')],
            ].map(([v, label]) => (
              <div key={String(label)}>
                <dt className="sr-only">{label}</dt>
                <dd className="text-lg font-bold tabular-nums">{v}</dd>
                <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                  {label}
                </p>
              </div>
            ))}
          </dl>

          <div className="mt-3 flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 text-sm"
              onClick={() => setDetailOf(r)}
            >
              {t('viewProgress')}
            </Button>
            <Button
              variant="ghost"
              className="text-sm"
              onClick={async () => {
                if (!confirm(t('removeConfirm'))) return
                // The only mutation on this screen that used to run bare. A
                // refused delete answers 204 exactly like a successful one, so
                // removeMember reads the membership back — and the failure has
                // to surface here or the teacher is told it worked.
                try {
                  await removeMember(cls.id, r.userId)
                  setError(null)
                } catch (e) {
                  setError(errorText(e))
                }
                await refresh()
              }}
            >
              {t('remove')}
            </Button>
          </div>
        </Card>
        ))}
    </div>
  )
}

/**
 * One learner in depth: WHERE they are struggling, not just that they are.
 * The topic bars come from the same computeProgress() the learner sees on
 * their own screen, so the two views can never disagree.
 */
// eslint-disable-next-line react-refresh/only-export-components -- exported so
// Classes.notes.test.tsx can drive the real component rather than a copy of it.
export function LearnerDetailView({
  cls,
  learner,
  onBack,
}: {
  cls: ClassRow
  learner: LearnerSummary
  onBack: () => void
}) {
  const { t, locale } = useKira()
  const errorText = useErrorText()
  const [detail, setDetail] = useState<LearnerDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openMiss, setOpenMiss] = useState<string | null>(null)
  // Notes live up here, not inside the row, so collapsing a miss (or opening
  // another) does not throw away what the teacher has typed. Since 0008 they
  // also outlive the page: what is held here is the working copy, and what is
  // in `saved` is what the server has actually confirmed.
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<Record<string, SaveResult | 'saving'>>({})
  const [loadedAt, setLoadedAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [bundleCopied, setBundleCopied] = useState<'no' | 'yes' | 'failed'>('no')

  /**
   * Reload the report. Note what it does NOT touch: `notes`, the teacher's
   * working copy. Refreshing a report while someone is halfway through writing
   * an explanation must not take the sentence out from under them.
   */
  const load = useCallback(async () => {
    setBusy(true)
    try {
      const d = await getLearnerDetail(cls.id, learner.userId)
      setDetail(d)
      // Bounded by the 5 misses on screen, never the whole bank.
      const stored = await getItemNotes(d.recentMisses.map((m) => m.itemId))
      const asRecord = Object.fromEntries(stored)
      setNotes((current) => ({ ...asRecord, ...current }))
      setSaved(asRecord)
      setLoadedAt(Date.now())
      setError(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }, [cls.id, learner.userId, errorText])

  useEffect(() => {
    void load()
  }, [load])

  /**
   * Save on blur, not on every keystroke: a note is a paragraph a teacher
   * writes in one go, and a debounce would mean the status line flickered
   * through "saving" while they were still mid-sentence.
   *
   * Nothing is written when the text has not changed — reopening a miss to
   * re-read a note must not touch the row or its timestamp.
   */
  const commitNote = useCallback(
    async (itemId: string) => {
      const text = notes[itemId] ?? ''
      if (text.trim() === (saved[itemId] ?? '')) return
      const identity = await getIdentity()
      if (!identity) {
        setStatus((s) => ({ ...s, [itemId]: 'failed' }))
        return
      }
      setStatus((s) => ({ ...s, [itemId]: 'saving' }))
      const result = await saveItemNote(identity.userId, itemId, text)
      setStatus((s) => ({ ...s, [itemId]: result }))
      // Only move the confirmed copy on a confirmed write, so a failure leaves
      // the teacher's text on screen and still marked unsaved.
      if (result !== 'failed') {
        setSaved((s) => ({ ...s, [itemId]: text.trim() }))
      }
    },
    [notes, saved],
  )

  const name = learner.displayName ?? `${learner.userId.slice(0, 8)}…`

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-5 py-6">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar seed={learner.userId} chosen={learner.avatar} />
          <h1 className="truncate text-xl font-bold">{name}</h1>
        </div>
        <Button variant="ghost" onClick={onBack}>
          {t('back')}
        </Button>
      </header>

      <p className="-mt-2 text-sm text-slate-500 dark:text-slate-400">
        {t('lastActive')}: {relativeTime(learner.lastActiveAt, t)}
      </p>

      <OfflineBanner />
      <ReportHeader loadedAt={loadedAt} busy={busy} onRefresh={() => void load()} />

      {error && (
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
      )}
      {!detail && !error && <p className="text-sm text-slate-500">{t('loading')}</p>}

      {detail && (
        <>
          {detail.weakest.length > 0 && (
            <Card>
              <h2 className="font-semibold">{t('weakest')}</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t('weakestHint')}
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {detail.weakest.map((w) => (
                  <li
                    key={w.tag}
                    className="flex items-baseline justify-between gap-3 text-sm"
                  >
                    <span className="truncate">{skillLabel(w.tag, locale)}</span>
                    <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                      {w.wrong}/{w.attempts} {t('wrongLabel')}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <h2 className="font-semibold">{t('byTopic')}</h2>
            <ul className="mt-3 flex flex-col gap-3">
              {detail.topics.map((tp) => (
                <li key={tp.topic.id}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{tc(tp.topic.title, locale)}</span>
                    <span className="shrink-0 tabular-nums text-slate-500 dark:text-slate-400">
                      {tp.seen === 0 ? t('notPractised') : `${tp.masteryPct}%`}
                    </span>
                  </div>
                  <ProgressBar
                    value={tp.masteryPct}
                    label={tc(tp.topic.title, locale)}
                    className="mt-1"
                  />
                  <p className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                    {tp.seen}/{tp.total} {t('seen')} · {tp.mastered}{' '}
                    {t('itemsMastered')}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="font-semibold">{t('recentMisses')}</h2>
            {detail.recentMisses.length === 0 ? (
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {detail.attempts === 0 ? t('actNotStartedHint') : t('noMisses')}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-3">
                {detail.recentMisses.map((m) => (
                  <MissRow
                    key={m.itemId}
                    miss={m}
                    learnerName={learner.displayName}
                    expanded={openMiss === m.itemId}
                    onToggle={() =>
                      setOpenMiss(openMiss === m.itemId ? null : m.itemId)
                    }
                    note={notes[m.itemId] ?? ''}
                    onNote={(v) => setNotes((n) => ({ ...n, [m.itemId]: v }))}
                    onCommitNote={() => commitNote(m.itemId)}
                    saveStatus={status[m.itemId] ?? null}
                    dirty={(notes[m.itemId] ?? '').trim() !== (saved[m.itemId] ?? '')}
                  />
                ))}
              </ul>
            )}

            {/* One brief per clipboard trip is right for the miss you happen to
                be reading; it is useless for the actual job, which is sitting
                down once and handing over everything that went wrong. */}
            {detail.recentMisses.some((m) => m.item) && (
              <div className="mt-4 border-t border-slate-200 pt-3 dark:border-slate-700">
                <Button
                  variant="secondary"
                  className="w-full text-sm"
                  onClick={async () => {
                    const bundle = buildBriefBundle(
                      detail.recentMisses
                        .filter((m) => m.item)
                        .map((m) => ({
                          item: m.item!,
                          topicTitle: m.topicTitle,
                          lessonTitle: m.lessonTitle,
                          wrong: m.wrong,
                          lastWrongAt: m.lastWrongAt,
                          siblings: m.siblings,
                          // the saved note, not the unsaved draft: the bundle
                          // should match what the teacher has committed
                          teacherNote: saved[m.itemId] ?? '',
                          learnerName: learner.displayName,
                          locale,
                          chosen:
                            m.item && m.chosen !== undefined
                              ? describeChosen(m.item, m.chosen, locale, t)
                              : null,
                        })),
                      learner.displayName,
                    )
                    const ok = await copyText(bundle)
                    setBundleCopied(ok ? 'yes' : 'failed')
                    if (ok) setTimeout(() => setBundleCopied('no'), 1500)
                  }}
                >
                  {bundleCopied === 'yes' ? t('copied') : t('copyAllBriefs')}
                </Button>
                <p className="mt-1.5 text-center text-xs text-slate-500 dark:text-slate-400">
                  {bundleCopied === 'failed'
                    ? t('copyBriefFailed')
                    : t('copyAllBriefsHint').replace(
                        '{n}',
                        String(detail.recentMisses.filter((m) => m.item).length),
                      )}
                </p>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  )
}


/**
 * One recently-missed question, openable.
 *
 * Collapsed it is what it always was: the prompt, the topic, how often. Opened
 * it shows the question the learner actually met, the answer, and the
 * explanation the app gave them — all of it already available locally, because
 * content is bundled and the server only ever sent an item id.
 *
 * The point of opening it is to be able to act: either the explanation is fine
 * and the learner needs more practice, or the explanation is the problem, and
 * the teacher is the person who knows what it should have said. Both come out
 * as a brief for whoever edits `seed_content.json`.
 */
function MissRow({
  miss,
  learnerName,
  expanded,
  onToggle,
  note,
  onNote,
  onCommitNote,
  saveStatus,
  dirty,
}: {
  miss: RecentMiss
  learnerName: string | null
  expanded: boolean
  onToggle: () => void
  note: string
  onNote: (v: string) => void
  onCommitNote: () => void
  saveStatus: SaveResult | 'saving' | null
  dirty: boolean
}) {
  const { t, locale } = useKira()
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no')
  const chosenLines =
    miss.item && miss.chosen !== undefined
      ? describeChosen(miss.item, miss.chosen, locale, t)
      : null

  return (
    <li>
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        className={`w-full rounded-xl px-1 py-0.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 ${FOCUS}`}
      >
        <p className="text-sm text-slate-800 dark:text-slate-100">
          {tc(miss.prompt, locale)}
        </p>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          {miss.topicTitle ? `${tc(miss.topicTitle, locale)} · ` : ''}
          {miss.wrong}
          {t('timesWrong')} · {relativeTime(miss.lastWrongAt, t)} ·{' '}
          <span className="font-semibold text-indigo-600 dark:text-indigo-400">
            {expanded ? t('hideQuestion') : t('showQuestion')}
          </span>
        </p>
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-2.5">
          {!miss.item ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t('itemMissing')}
            </p>
          ) : (
            <>
              <ItemPreview item={miss.item} locale={locale} />

              {/* Only rendered once 0007 is applied AND an answer was stored:
                  undefined means we were never told, which is not the same as
                  "she answered nothing". */}
              {miss.chosen !== undefined && (
                <div>
                  <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    {t('whatTheyPut')}
                  </p>
                  {chosenLines === null ? (
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      {t('answerUnknown')}
                    </p>
                  ) : (
                    <>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {t('whatTheyPutHint')}
                      </p>
                      <div className="mt-1 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200 dark:bg-slate-900/40 dark:ring-slate-700">
                        {chosenLines.map((line, i) => (
                          <div
                            key={i}
                            className="flex items-baseline justify-between gap-3 py-1 text-sm"
                          >
                            <span className="min-w-0 text-slate-600 dark:text-slate-300">
                              {line.label}
                            </span>
                            <span
                              className={`shrink-0 font-semibold tabular-nums ${
                                line.ok
                                  ? 'text-slate-500 dark:text-slate-400'
                                  : 'text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {line.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              <div>
                <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
                  {t('explanationSeen')}
                </p>
                <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-200">
                  {tc(miss.item.explanation, locale)}
                </p>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                {miss.siblings > 0
                  ? t('siblingsCount').replace('{n}', String(miss.siblings))
                  : t('siblingsNone')}
              </p>

              <div>
                <label
                  htmlFor={`note-${miss.itemId}`}
                  className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400"
                >
                  {t('betterExplanation')}
                </label>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {t('betterExplanationHint')}
                </p>
                <textarea
                  id={`note-${miss.itemId}`}
                  value={note}
                  onChange={(e) => onNote(e.target.value)}
                  onBlur={onCommitNote}
                  rows={3}
                  maxLength={NOTE_MAX}
                  placeholder={t('betterExplanationPlaceholder')}
                  className="mt-1.5 w-full rounded-2xl bg-white p-3 text-sm ring-1 ring-slate-200 outline-none placeholder:text-slate-400 dark:bg-slate-800 dark:text-white dark:ring-slate-700"
                />
                {/* Never claim a save that was not observed: `failed` covers
                    both a rejected write and 0008 not being applied yet, and
                    in both cases the text is still on screen to copy out. */}
                <p
                  role="status"
                  className={`mt-1 text-xs ${
                    saveStatus === 'failed'
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {saveStatus === 'saving'
                    ? t('noteSaving')
                    : saveStatus === 'failed'
                      ? t('noteSaveFailed')
                      : dirty
                        ? t('noteUnsaved')
                        : saveStatus === 'saved' || saveStatus === 'cleared'
                          ? t('noteSaved')
                          : note
                            ? t('noteSaved')
                            : ''}
                </p>
              </div>

              <Button
                variant="secondary"
                onClick={async () => {
                  const brief = buildAuthoringBrief({
                    item: miss.item!,
                    topicTitle: miss.topicTitle,
                    lessonTitle: miss.lessonTitle,
                    wrong: miss.wrong,
                    lastWrongAt: miss.lastWrongAt,
                    siblings: miss.siblings,
                    teacherNote: note,
                    learnerName,
                    locale,
                    chosen: chosenLines,
                  })
                  // Never claim success without checking: the clipboard is
                  // unavailable in an insecure context and fails silently.
                  const ok = await copyText(brief)
                  setCopied(ok ? 'yes' : 'failed')
                  if (ok) setTimeout(() => setCopied('no'), 1500)
                }}
              >
                {copied === 'yes' ? t('copied') : t('copyBrief')}
              </Button>
              {copied === 'failed' && (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {t('copyBriefFailed')}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </li>
  )
}
