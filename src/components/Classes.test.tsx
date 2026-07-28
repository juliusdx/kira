import { describe, it, expect } from 'vitest'
import { relativeTime } from './Classes'
import { UI, tr } from '../i18n/strings'
import type { UIKey } from '../i18n/strings'

const NOW = Date.parse('2026-07-28T12:00:00.000Z')
const day = 86_400_000
const en = (k: UIKey) => tr(k, 'en')
const ms = (k: UIKey) => tr(k, 'ms')

describe('relativeTime', () => {
  it('reads in English', () => {
    expect(relativeTime(null, en, NOW)).toBe('Never')
    expect(relativeTime(new Date(NOW - 2 * 3600_000).toISOString(), en, NOW)).toBe('today')
    expect(relativeTime(new Date(NOW - day).toISOString(), en, NOW)).toBe('yesterday')
    expect(relativeTime(new Date(NOW - 5 * day).toISOString(), en, NOW)).toBe('5d ago')
    expect(relativeTime(new Date(NOW - 70 * day).toISOString(), en, NOW)).toBe('2mo ago')
  })

  // The regression: these strings used to be hardcoded English on every roster
  // card, in an app that defaults to Bahasa Malaysia.
  it('reads in BM, with the count substituted', () => {
    expect(relativeTime(null, ms, NOW)).toBe('Tidak pernah')
    expect(relativeTime(new Date(NOW - day).toISOString(), ms, NOW)).toBe('semalam')
    expect(relativeTime(new Date(NOW - 5 * day).toISOString(), ms, NOW)).toBe('5 hari lalu')
    expect(relativeTime(new Date(NOW - 70 * day).toISOString(), ms, NOW)).toBe('2 bulan lalu')
  })

  it('never leaves a {n} placeholder on screen', () => {
    for (const days of [2, 10, 29, 30, 400]) {
      const iso = new Date(NOW - days * day).toISOString()
      expect(relativeTime(iso, en, NOW)).not.toContain('{n}')
      expect(relativeTime(iso, ms, NOW)).not.toContain('{n}')
    }
  })

  it('a future timestamp reads as today rather than a negative count', () => {
    expect(relativeTime(new Date(NOW + day).toISOString(), en, NOW)).toBe('today')
  })
})

describe('UI strings', () => {
  it('every key is bilingual — a missing BM string falls back to English silently', () => {
    const missing = Object.entries(UI)
      .filter(([, v]) => !v.en?.trim() || !v.ms?.trim())
      .map(([k]) => k)
    expect(missing).toEqual([])
  })
})
