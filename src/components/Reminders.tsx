import { useCallback, useEffect, useState } from 'react'
import { useKira } from '../app/KiraContext'
import { Button, Card, FOCUS } from './ui'
import {
  disablePush,
  enablePush,
  getPushState,
  PUSH_CONFIGURED,
  pushDiagnostics,
  setReminderHour,
  testNotification,
  type PushDiagnostics,
  type PushState,
} from '../sync/push'

// Daily reminder control. Hidden entirely when push is not configured, so a
// build without VAPID keys shows nothing rather than a dead switch.

const HOURS = [7, 8, 17, 18, 19, 20, 21]

export function Reminders() {
  const { t } = useKira()
  const [state, setState] = useState<PushState | null>(null)
  const [hour, setHour] = useState(19)
  const [busy, setBusy] = useState(false)
  const [tested, setTested] = useState<'no' | 'ok' | 'failed'>('no')
  const [diag, setDiag] = useState<PushDiagnostics | null>(null)

  const refresh = useCallback(async () => {
    setState(await getPushState())
  }, [])

  useEffect(() => {
    if (PUSH_CONFIGURED) void refresh()
  }, [refresh])

  if (!PUSH_CONFIGURED || state === null) return null
  if (state === 'unsupported') return null

  return (
    <Card>
      <h2 className="font-semibold">{t('reminders')}</h2>

      {state === 'ios-needs-install' ? (
        // Telling an iPhone user WHY beats showing a button that does nothing.
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {t('remindersIos')}
        </p>
      ) : state === 'denied' ? (
        <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
          {t('remindersBlocked')}
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t('remindersBody')}
          </p>

          <div className="mt-3 flex items-center gap-2">
            <label className="text-sm font-medium" htmlFor="rem-hour">
              {t('remindAt')}
            </label>
            <select
              id="rem-hour"
              value={hour}
              onChange={async (e) => {
                const h = Number(e.target.value)
                setHour(h)
                if (state === 'on') await setReminderHour(h)
              }}
              className={`min-h-11 rounded-xl bg-white px-3 text-base ring-1 ring-slate-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700 ${FOCUS}`}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {`${h}`.padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>

          <Button
            variant={state === 'on' ? 'secondary' : 'primary'}
            className="mt-3 w-full"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                setState(state === 'on' ? await disablePush() : await enablePush(hour))
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy
              ? t('loading')
              : state === 'on'
                ? t('remindersOff')
                : t('remindersOn')}
          </Button>

          {state === 'on' && (
            <>
              <p className="mt-2 text-center text-xs text-emerald-600 dark:text-emerald-400">
                {t('remindersActive')}
              </p>

              {/* Separates "notifications cannot display" from "push did not
                  arrive" — without this the two look identical on a phone. */}
              <Button
                variant="ghost"
                className="mt-2 w-full"
                onClick={async () => {
                  const ok = await testNotification()
                  setDiag(await pushDiagnostics())
                  setTested(ok ? 'ok' : 'failed')
                }}
              >
                {t('testNotification')}
              </Button>

              {tested === 'failed' && (
                <p className="mt-1 text-center text-xs text-rose-600 dark:text-rose-400">
                  {t('testFailed')}
                </p>
              )}
              {tested === 'ok' && (
                <p className="mt-1 text-center text-xs text-slate-500">
                  {t('testSent')}
                </p>
              )}

              {diag && (
                <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-100 p-3 text-[11px] leading-relaxed text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {`permission   ${diag.permission}
sw active    ${diag.swActive}
subscription ${diag.hasSubscription}
push handler ${diag.pushHandlerPresent}
endpoint     ${diag.endpointHost ?? '—'}
p256dh len   ${diag.p256dhLength}
auth len     ${diag.authLength}`}
                </pre>
              )}
            </>
          )}
        </>
      )}
    </Card>
  )
}
