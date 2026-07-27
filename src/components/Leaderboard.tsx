import { useCallback, useEffect, useState } from 'react'
import { useKira } from '../app/KiraContext'
import { Card } from './ui'
import { getLeaderboard, type LeaderRow } from '../sync/classes'
import { getIdentity } from '../sync/identity'

// Class ranking. Served by a SECURITY DEFINER function, so this shows ranks
// without any classmate gaining read access to another's answers.

const MEDALS = ['🥇', '🥈', '🥉']

export function Leaderboard({ classId }: { classId: string }) {
  const { t } = useKira()
  const [rows, setRows] = useState<LeaderRow[] | null>(null)
  const [me, setMe] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [data, id] = await Promise.all([getLeaderboard(classId), getIdentity()])
      setRows(data)
      setMe(id?.userId ?? null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [classId])

  useEffect(() => {
    void load()
  }, [load])

  if (error) {
    return (
      <Card>
        <p className="text-sm font-medium text-rose-600 dark:text-rose-400">{error}</p>
      </Card>
    )
  }

  return (
    <Card>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="font-bold text-slate-900 dark:text-white">
          {t('leaderboard')}
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        {t('leaderboardHint')}
      </p>

      {rows === null && <p className="text-sm text-slate-500">{t('loading')}</p>}
      {rows?.length === 0 && (
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('noActivity')}</p>
      )}

      <ol className="grid gap-1">
        {rows?.map((r, i) => {
          const mine = r.userId === me
          return (
            <li
              key={r.userId}
              className={`flex items-center gap-3 rounded-xl px-2 py-2 ${
                mine ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''
              }`}
            >
              <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-slate-400">
                {MEDALS[i] ?? i + 1}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-sm ${
                  mine
                    ? 'font-bold text-indigo-700 dark:text-indigo-300'
                    : 'font-medium text-slate-700 dark:text-slate-300'
                }`}
              >
                {r.displayName}
                {mine && (
                  <span className="ml-1.5 text-xs font-normal opacity-70">
                    ({t('you')})
                  </span>
                )}
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-slate-900 dark:text-white">
                {r.score}
              </span>
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
