import { useCallback, useEffect, useState } from 'react'
import { useKira } from '../app/KiraContext'
import { Button, Card, FOCUS } from './ui'
import {
  confirmEmailLink,
  confirmEmailSignIn,
  getIdentity,
  signOut,
  startEmailLink,
  startEmailSignIn,
  type Identity,
} from '../sync/identity'
import { friendlyAuthError, type FriendlyAuthError } from '../sync/authErrors'

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
    const res =
      mode === 'linking'
        ? await confirmEmailLink(email, code)
        : await confirmEmailSignIn(email, code)
    setBusy(false)
    if (!res.ok) {
      setError(friendlyAuthError(res.error ?? ''))
      return
    }
    setMode('idle')
    setStep('email')
    setCode('')
    await refresh()
    onChanged()
  }, [code, email, mode, refresh, onChanged])

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
              onClick={() => setMode('signingIn')}
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
              <label className="text-sm font-medium" htmlFor="acct-code">
                {t('codeLabel')}
              </label>
              <input
                id="acct-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className={`${input} ${FOCUS} tracking-[0.3em] tabular-nums`}
                placeholder="000000"
              />
              <Button disabled={busy || code.length < 6} onClick={() => void verify()}>
                {busy ? t('loading') : t('verify')}
              </Button>
            </div>
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
