import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Locale } from '../content/types'
import { getLocale, setLocale as persistLocale } from '../db/data'
import { tr, type UIKey } from '../i18n/strings'

interface KiraCtx {
  locale: Locale
  setLocale: (l: Locale) => void
  toggleLocale: () => void
  ready: boolean
  /** translate a UI chrome key */
  t: (key: UIKey) => string
}

const Ctx = createContext<KiraCtx | null>(null)

export function KiraProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ms')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let alive = true
    getLocale().then((l) => {
      if (alive) {
        setLocaleState(l)
        setReady(true)
      }
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l)
    void persistLocale(l)
  }, [])

  const toggleLocale = useCallback(() => {
    setLocaleState((cur) => {
      const next: Locale = cur === 'ms' ? 'en' : 'ms'
      void persistLocale(next)
      return next
    })
  }, [])

  const value = useMemo<KiraCtx>(
    () => ({
      locale,
      setLocale,
      toggleLocale,
      ready,
      t: (key: UIKey) => tr(key, locale),
    }),
    [locale, setLocale, toggleLocale, ready],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useKira(): KiraCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useKira must be used within KiraProvider')
  return ctx
}
