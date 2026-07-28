import { useCallback, useEffect, useState } from 'react'
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
  type ClassRow,
  type LearnerDetail,
  type LearnerSummary,
} from '../sync/classes'
import { skillLabel, t as tc } from '../content/loader'
import type { UIKey } from '../i18n/strings'
import { getIdentity } from '../sync/identity'
import { copyText } from '../lib/clipboard'
import { Leaderboard } from './Leaderboard'

// Teacher dashboard + learner join flow. All reads are RLS-gated server-side:
// a teacher only ever receives rows for learners who joined their class.

const input =
  'min-h-12 w-full rounded-2xl bg-white px-4 text-base ring-1 ring-slate-200 outline-none placeholder:text-slate-400 dark:bg-slate-800 dark:text-white dark:ring-slate-700'

/** ABCD-EFGH-IJKL — the stored code has no separators. */
function formatCode(code: string): string {
  return code.replace(/(.{4})(?=.)/g, '$1-')
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
  const [mine, setMine] = useState<ClassRow[]>([])
  const [joined, setJoined] = useState<ClassRow[]>([])
  const [open, setOpen] = useState<ClassRow | null>(null)
  const [hasEmail, setHasEmail] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)

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
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

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
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [code, refresh])

  const doCreate = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      await createClass(newName)
      setNewName('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [newName, refresh])

  if (open) {
    return <Roster cls={open} onBack={() => { setOpen(null); void refresh() }} />
  }

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
                      setError(e instanceof Error ? e.message : String(e))
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
  const [rows, setRows] = useState<LearnerSummary[] | null>(null)
  const [code, setCode] = useState(cls.join_code)
  const [copied, setCopied] = useState<'no' | 'yes' | 'failed'>('no')
  const [error, setError] = useState<string | null>(null)
  const [detailOf, setDetailOf] = useState<LearnerSummary | null>(null)

  const refresh = useCallback(async () => {
    try {
      setRows(await getClassRoster(cls.id))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [cls.id])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (detailOf)
    return (
      <LearnerDetailView
        cls={cls}
        learner={detailOf}
        onBack={() => setDetailOf(null)}
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
                setError(e instanceof Error ? e.message : String(e))
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

      <h2 className="px-1 font-semibold">{t('learners')}</h2>

      {rows === null && <p className="px-1 text-sm text-slate-500">{t('loading')}</p>}
      {rows?.length === 0 && (
        <Card>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('noLearners')}</p>
        </Card>
      )}

      {rows?.map((r) => (
        <Card key={r.userId}>
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate font-semibold">
              {r.displayName ?? `${r.userId.slice(0, 8)}…`}
            </span>
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
              {t('lastActive')}: {relativeTime(r.lastActiveAt, t)}
            </span>
          </div>

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
                await removeMember(cls.id, r.userId)
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
function LearnerDetailView({
  cls,
  learner,
  onBack,
}: {
  cls: ClassRow
  learner: LearnerSummary
  onBack: () => void
}) {
  const { t, locale } = useKira()
  const [detail, setDetail] = useState<LearnerDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getLearnerDetail(cls.id, learner.userId)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)))
    return () => {
      alive = false
    }
  }, [cls.id, learner.userId])

  const name = learner.displayName ?? `${learner.userId.slice(0, 8)}…`

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-5 py-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="truncate text-xl font-bold">{name}</h1>
        <Button variant="ghost" onClick={onBack}>
          {t('back')}
        </Button>
      </header>

      <p className="-mt-2 text-sm text-slate-500 dark:text-slate-400">
        {t('lastActive')}: {relativeTime(learner.lastActiveAt, t)}
      </p>

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
                {t('noMisses')}
              </p>
            ) : (
              <ul className="mt-2 flex flex-col gap-3">
                {detail.recentMisses.map((m) => (
                  <li key={m.itemId}>
                    <p className="text-sm text-slate-800 dark:text-slate-100">
                      {tc(m.prompt, locale)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {m.topicTitle ? `${tc(m.topicTitle, locale)} · ` : ''}
                      {m.wrong}
                      {t('timesWrong')} · {relativeTime(m.lastWrongAt, t)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </div>
  )
}

