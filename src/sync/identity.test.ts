import { describe, it, expect } from 'vitest'
import { resolveAppUrl } from './identity'

// Regression tests for the emailed-link redirect landing on a 404.
//
// Supabase dropped the path from Site URL and sent users to
// https://juliusdx.github.io/ — the root of a GitHub Pages *project* site,
// which has no content. We now pass the redirect explicitly.

describe('resolveAppUrl', () => {
  // vite is configured with `base: './'`, so BASE_URL is './' — NOT '/kira/'
  const BASE = './'

  it('keeps the /kira/ subdirectory in production', () => {
    expect(resolveAppUrl(BASE, 'https://juliusdx.github.io/kira/')).toBe(
      'https://juliusdx.github.io/kira/',
    )
  })

  it('resolves from index.html to its directory, not the root', () => {
    expect(resolveAppUrl(BASE, 'https://juliusdx.github.io/kira/index.html')).toBe(
      'https://juliusdx.github.io/kira/',
    )
  })

  it('NEVER collapses to the bare origin — that is the 404 bug', () => {
    const got = resolveAppUrl(BASE, 'https://juliusdx.github.io/kira/')
    expect(got).not.toBe('https://juliusdx.github.io/')
    expect(got).toContain('/kira/')
  })

  it('strips an existing token fragment so we never echo credentials back', () => {
    const got = resolveAppUrl(
      BASE,
      'https://juliusdx.github.io/kira/#access_token=secret&refresh_token=alsosecret',
    )
    expect(got).toBe('https://juliusdx.github.io/kira/')
    expect(got).not.toContain('secret')
  })

  it('strips query strings too', () => {
    expect(resolveAppUrl(BASE, 'https://juliusdx.github.io/kira/?foo=bar')).toBe(
      'https://juliusdx.github.io/kira/',
    )
  })

  it('works at a domain root in dev', () => {
    expect(resolveAppUrl(BASE, 'http://localhost:5178/')).toBe('http://localhost:5178/')
  })

  it('still works if base is ever changed to an absolute path', () => {
    expect(resolveAppUrl('/kira/', 'https://juliusdx.github.io/kira/')).toBe(
      'https://juliusdx.github.io/kira/',
    )
  })
})
