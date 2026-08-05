import { describe, it, expect } from 'vitest'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'
import { isAllowed, needsOptIn, targetRef, refuseMessage, OPT_IN, PROD_REF } from './prod-test-guard.mjs'

// A guard against touching production deserves what a migration gets.
//
// The load-bearing tests are the SUBPROCESS ones. v1 of this guard shipped
// with unit tests over isAllowed() that all passed green while the actual
// script exited 0 and let the integration suite run against prod. Testing the
// decision function proved nothing about the thing package.json invokes —
// the same shape as this repo's duplicate-item-id lesson: a guard that reads
// its subject through the code that normalises the fault cannot see it.

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)))

/** Run the guard exactly as package.json does: relative path, from the root. */
function runGuard(env = {}) {
  return spawnSync('node', ['scripts/confirm-prod-tests.mjs'], {
    cwd: repoRoot,
    env: { ...process.env, [OPT_IN]: '', ...env },
    encoding: 'utf8',
  })
}

describe('the guard script itself', () => {
  it('EXITS NON-ZERO with no opt-in, so `&& vitest` never runs', () => {
    // This is the assertion the whole file exists for.
    const r = runGuard()
    expect(r.status, `stdout: ${r.stdout}\nstderr: ${r.stderr}`).toBe(1)
  })

  it('says what it refused and how to proceed', () => {
    const r = runGuard()
    expect(r.stderr).toContain('REFUSED')
    expect(r.stderr).toContain(`${OPT_IN}=1`)
  })

  it('exits zero when the opt-in is explicit', () => {
    // Only the guard runs here — never the suite, which would mint more users.
    const r = runGuard({ [OPT_IN]: '1' })
    expect(r.status, r.stderr).toBe(0)
    expect(r.stdout).toContain('LIVE')
  })

  it('refuses a half-set variable', () => {
    // `export KIRA_ALLOW_PROD_TESTS=` reads as "set" to a truthy check.
    for (const v of ['', '0', 'false', 'yes'])
      expect(runGuard({ [OPT_IN]: v }).status, JSON.stringify(v)).toBe(1)
  })
})

describe('which targets need the opt-in', () => {
  it('production does', () => {
    expect(needsOptIn({ ref: PROD_REF, file: '.env' })).toBe(true)
  })

  it('a dev project does NOT — the point of having one', () => {
    expect(needsOptIn({ ref: 'somedevproject', file: '.env.test.local' })).toBe(false)
  })

  it('an UNKNOWN target counts as production', () => {
    // No .env, an unreadable one, or an unparseable URL. "I could not tell"
    // must never mean "go".
    expect(needsOptIn(null)).toBe(true)
  })
})

describe('the decision', () => {
  it('refuses by default', () => {
    expect(isAllowed({})).toBe(false)
  })

  it('allows an explicit 1 or true, case and whitespace forgiven', () => {
    for (const v of ['1', 'true', 'TRUE', ' true '])
      expect(isAllowed({ [OPT_IN]: v }), JSON.stringify(v)).toBe(true)
  })

  it('names the project it would hit, so a dev/prod mix-up is visible', () => {
    const read = (f) =>
      f === '.env' ? 'VITE_SUPABASE_URL=https://ccbioktxfpeqaocjkqpr.supabase.co\n' : null
    expect(targetRef(read)).toEqual({ ref: 'ccbioktxfpeqaocjkqpr', file: '.env' })
  })

  it('prefers .env.local over .env, as Vite does', () => {
    const read = (f) =>
      f === '.env.local'
        ? 'VITE_SUPABASE_URL=https://devproject.supabase.co'
        : 'VITE_SUPABASE_URL=https://prodproject.supabase.co'
    expect(targetRef(read).ref).toBe('devproject')
  })

  it('resolves a file: URL with a space, which is what broke v1', () => {
    // The checkout this is developed in lives at ".../Kira Accounting Tutor/",
    // so import.meta.url percent-encodes the space and naive string surgery
    // yields a path that does not exist — the .env read then fails silently.
    //
    // Asserted on a SYNTHETIC url, deliberately. The first version of this
    // test asserted the real repo path contained a space, which is true on the
    // author's Mac and false on CI (/home/runner/work/kira/kira) — a test that
    // encodes the machine rather than the code, and it went red on the first
    // push. Same category of mistake as the bug it was written to guard.
    const url = 'file:///Users/j/Kira%20Accounting%20Tutor/scripts/x.mjs'
    expect(fileURLToPath(url)).toBe('/Users/j/Kira Accounting Tutor/scripts/x.mjs')
    expect(url.replace('file://', '')).not.toBe(fileURLToPath(url))
  })

  it('survives a missing or unparseable .env rather than throwing', () => {
    expect(targetRef(() => null)).toBe(null)
    expect(targetRef(() => 'NOT_THE_VAR=1\n')).toBe(null)
  })

  it('tells you what to run instead, not just no', () => {
    const msg = refuseMessage(null)
    expect(msg).toContain('npm test')
    expect(msg).toContain('localonly')
  })
})
