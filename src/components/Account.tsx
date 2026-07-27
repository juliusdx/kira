import { useCallback, useEffect, useState } from 'react'
import { useKira } from '../app/KiraContext'
import { Button, Card, FOCUS } from './ui'
import {
  confirmEmailLink,
  confirmEmailSignIn,
  getIdentity,
  refreshIdentity,
  signOut,
  startEmailLink,
  startEmailSignIn,
  type Identity,
} from '../sync/identity'
import { friendlyAuthError, type FriendlyAuthError } from '../sync/authErrors'
import { syncNow } from '../sync/sync'
import { db } from '../db/db'

// Account screen: turn an anonymous device-bound learner into a durable
// account, or sign back in on a new device. Linking keeps the SAME user id, so
// no progress is lost.

type Mode = 'idle' | 'linking' | 'signingIn'
type Step = 'email' | 'code'

const input =
  'min-h-12 w-full rounded-2xl bg-white px-4 text-base ring-1 ring-slate-200 outline-none placeholder:text-slate-400 dark:bg-slate-800 dark:text-white dark:ring-slate-700'

export function Account({ onBack, onChanged }: { onBack: () => void; onChanged: () => void }) {
  const { t } = useKira()
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [mode, setMode] = useState<Mode>('idle')
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<FriendlyAuthError | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIdentity(await getIdentity())
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const sendCode = useCallback(async () => {
    setBusy(true)
    setError(null)
    const res =
      mode === 'linking' ? await startEmailLink(email) : await startEmailSignIn(email)
    setBusy(false)
    if (!res.ok) {
      setError(friendlyAuthError(res.error ?? ''))
      return
    }
    setStep('code')
  }, [email, mode])

  const verify = useCallback(async () => {
    setBusy(true)
    setError(null)

    // Flush anything unsynced while we are still the CURRENT user, so their
    // work lands in their own account rather than being wiped below.
    if (mode === 'signingIn') await syncNow()

    const res =
      mode === 'linking'
        ? await confirmEmailLink(email, code)
        : await confirmEmailSignIn(email, code)
    if (!res.ok) {
      setBusy(false)
      setError(friendlyAuthError(res.error ?? ''))
      return
    }

    // syncNow detects the account changed and adopts it — wiping this
    // device's rows rather than merging them in. Linking keeps local data,
    // because the user id is unchanged.
    await syncNow()

    setBusy(false)
    setMode('idle')
    setStep('email')
    setCode('')
    await refresh()
    onChanged()
  }, [code, email, mode, refresh, onChanged])

  /**
   * The user confirmed by clicking the link instead of typing a code. Pull a
   * fresh session and see whether the email actually landed on the account.
   */
  const checkLink = useCallback(async () => {
    setBusy(true)
    setError(null)
    const id = await refreshIdentity()
    setBusy(false)
    if (!id?.email) {
      setNotice(t('notConfirmedYet'))
      return
    }
    setIdentity(id)
    setMode('idle')
    setStep('email')
    setCode('')
    setNotice(null)
    onChanged()
  }, [onChanged, t])

  const reset = () => {
    setMode('idle')
    setStep('email')
    setError(null)
    setCode('')
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{t('account')}</h1>
        <Button variant="ghost" onClick={onBack}>
          {t('back')}
        </Button>
      </header>

      <Card>
        {identity?.email ? (
          <>
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('savedAs')}</p>
            <p className="mt-1 font-semibold break-all">{identity.email}</p>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={async () => {
                await signOut()
                await refresh()
                onChanged()
              }}
            >
              {t('signOut')}
            </Button>
          </>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('notSaved')}</p>
        )}
        {/* Anonymous identities are per-origin and per-browser-profile, so
            "why doesn't this device show my email?" is otherwise unanswerable. */}
        {identity && (
          <p className="mt-2 font-mono text-xs text-slate-400 dark:text-slate-500">
            id {identity.userId.slice(0, 8)}
          </p>
        )}
      </Card>

      {!identity?.email && mode === 'idle' && (
        <>
          <Card>
            <h2 className="font-semibold">{t('saveProgress')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('saveProgressBody')}
            </p>
            <Button className="mt-4 w-full" onClick={() => setMode('linking')}>
              {t('saveProgress')}
            </Button>
          </Card>

          <Card>
            <h2 className="font-semibold">{t('signIn')}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t('signInBody')}
            </p>
            <Button
              variant="secondary"
              className="mt-4 w-full"
              onClick={async () => {
                // Only warn when there is actually something to lose.
                const local = await db.reviewState.count()
                if (local > 0 && !window.confirm(t('signInReplaceWarn'))) return
                setMode('signingIn')
              }}
            >
              {t('signIn')}
            </Button>
          </Card>
        </>
      )}

      {mode !== 'idle' && (
        <Card>
          <h2 className="font-semibold">
            {mode === 'linking' ? t('saveProgress') : t('signIn')}
          </h2>

          {step === 'email' ? (
            <div className="mt-3 flex flex-col gap-3">
              <label className="text-sm font-medium" htmlFor="acct-email">
                {t('emailLabel')}
              </label>
              <input
                id="acct-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`${input} ${FOCUS}`}
                placeholder="you@example.com"
              />
              <Button disabled={busy || !email.includes('@')} onClick={() => void sendCode()}>
                {busy ? t('loading') : t('sendCode')}
              </Button>
            </div>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {t('codeSentTo')} <span className="font-medium break-all">{email}</span>
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('codeOrLink')}</p>
              <label className="text-sm font-medium" htmlFor="acct-code">
                {t('codeLabel')}
              </label>
              <input
                id="acct-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                // strip whitespace so a code pasted as "7784 8142" still works
                onChange={(e) => setCode(e.target.value.replace(/\s+/g, ''))}
                className={`${input} ${FOCUS} tracking-[0.3em] tabular-nums`}
                placeholder="••••••"
              />
              <Button disabled={busy || code.trim().length < 6} onClick={() => void verify()}>
                {busy ? t('loading') : t('verify')}
              </Button>
              {/* Supabase's default template sends a link and no code, so
                  offer the click-the-link path as a first-class route. */}
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => void checkLink()}
              >
                {busy ? t('loading') : t('iClickedLink')}
              </Button>
            </div>
          )}

          {notice && (
            <p className="mt-3 text-sm font-medium text-amber-600 dark:text-amber-400">
              {notice}
            </p>
          )}

          {error && (
            <div className="mt-3">
              <p className="text-sm font-medium text-rose-600 dark:text-rose-400">
                {t(error.key)}
                {/* keep the raw text visible when unmapped, so real bugs show */}
                {error.raw && (
                  <span className="mt-1 block font-normal opacity-70">{error.raw}</span>
                )}
              </p>
              {/* wrong flow: one tap moves them to the one that works */}
              {error.suggestLink && (
                <Button
                  variant="secondary"
                  className="mt-3 w-full"
                  onClick={() => {
                    setMode('linking')
                    setStep('email')
                    setError(null)
                  }}
                >
                  {t('errNoAccountFix')}
                </Button>
              )}
            </div>
          )}

          <Button variant="ghost" className="mt-2 w-full" onClick={reset}>
            {t('back')}
          </Button>
        </Card>
      )}
    </div>
  )
}
