import { useEffect, useRef, useState, type ReactNode } from 'react'
import { avatarFor } from '../app/avatar'
import { FOCUS } from './ui'

// Playful surface, used ONLY on learner screens (Home, session end, badges).
// Teacher and parent screens deliberately keep the sober `ui.tsx` language:
// a progress report should look like a report, not like a game.
//
// Every animation here is opt-out under prefers-reduced-motion — the values
// still land, they just arrive instantly.

/** True when the viewer has asked for less motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return reduced
}

/** A number that counts up to its value. Reduced motion jumps straight there. */
export function CountUp({
  value,
  duration = 700,
  className = '',
}: {
  value: number
  duration?: number
  className?: string
}) {
  const reduced = useReducedMotion()
  const [shown, setShown] = useState(reduced ? value : 0)
  const raf = useRef(0)

  useEffect(() => {
    if (reduced) {
      setShown(value)
      return
    }
    const start = performance.now()
    const from = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      // ease-out cubic: fast then settling, which reads as "landing on" a number
      const eased = 1 - Math.pow(1 - p, 3)
      setShown(Math.round(from + (value - from) * eased))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration, reduced])

  return <span className={`tabular-nums ${className}`}>{shown}</span>
}

/** Circular mastery dial — the headline "how far am I" on Home. */
export function Ring({
  value,
  size = 132,
  stroke = 12,
  children,
}: {
  value: number // 0..100
  size?: number
  stroke?: number
  children?: ReactNode
}) {
  const reduced = useReducedMotion()
  const pct = Math.max(0, Math.min(100, value))
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-slate-200 dark:stroke-slate-700"
        />
        <defs>
          <linearGradient id="kira-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="60%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke="url(#kira-ring)"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct / 100)}
          style={{
            transition: reduced ? undefined : 'stroke-dashoffset 900ms cubic-bezier(.2,.8,.2,1)',
          }}
        />
      </svg>
      <div className="absolute grid place-items-center text-center">{children}</div>
    </div>
  )
}

/** The learner's face. `seed` is their user id; `chosen` their preference. */
export function Avatar({
  seed,
  chosen,
  size = 'md',
  className = '',
}: {
  seed: string | null | undefined
  chosen?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const { emoji, tone } = avatarFor(seed, chosen)
  const dims =
    size === 'lg'
      ? 'h-16 w-16 text-4xl'
      : size === 'sm'
        ? 'h-8 w-8 text-lg'
        : 'h-12 w-12 text-2xl'
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-2xl ${tone} ${dims} ${className}`}
      role="img"
      aria-hidden
    >
      {emoji}
    </span>
  )
}

/** A softly glowing panel — the learner-side equivalent of Card. */
export function PlayCard({
  children,
  className = '',
  glow = false,
}: {
  children: ReactNode
  className?: string
  glow?: boolean
}) {
  return (
    <div
      className={`rounded-3xl bg-white p-5 ring-1 ring-slate-200/70 dark:bg-slate-800/60 dark:ring-slate-700/70 ${
        glow ? 'shadow-lg shadow-indigo-500/10 ring-indigo-300/60 dark:ring-indigo-400/30' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}

/** Chunky primary action with a little lift. */
export function BigButton({
  children,
  className = '',
  ...rest
}: { children: ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-3xl bg-gradient-to-br from-indigo-500 to-indigo-600 px-6 text-lg font-extrabold text-white shadow-lg shadow-indigo-600/25 transition active:scale-[0.98] disabled:from-slate-300 disabled:to-slate-300 disabled:text-slate-500 disabled:shadow-none motion-reduce:active:scale-100 dark:disabled:from-slate-700 dark:disabled:to-slate-700 ${FOCUS} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

/**
 * A short burst of colour for the moment something is earned. Pure CSS, no
 * canvas, and it renders nothing at all under reduced motion.
 */
export function Burst({ count = 14 }: { count?: number }) {
  const reduced = useReducedMotion()
  // Positions are derived from the index, never random: a re-render must not
  // reshuffle the pieces mid-flight.
  if (reduced) return null
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360
        const delay = (i % 5) * 60
        const hue = ['bg-amber-400', 'bg-indigo-400', 'bg-emerald-400', 'bg-rose-400', 'bg-sky-400'][i % 5]
        return (
          <span
            key={i}
            className={`kira-confetti absolute top-1/2 left-1/2 h-2 w-2 rounded-sm ${hue}`}
            style={{
              // @ts-expect-error custom properties are valid inline styles
              '--kira-angle': `${angle}deg`,
              animationDelay: `${delay}ms`,
            }}
          />
        )
      })}
    </div>
  )
}
