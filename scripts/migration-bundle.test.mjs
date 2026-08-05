import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildBundle, migrationFiles, OUTPUT } from './migration-bundle.mjs'

// The bundle is a COPY of the schema, and a stale copy is worse than none —
// it would silently bootstrap a new project one migration behind, and the
// missing piece would surface later as an RLS hole or a missing function.

describe('the bootstrap bundle', () => {
  it('matches the migrations — regenerate with `node scripts/bundle-migrations.mjs`', () => {
    expect(readFileSync(OUTPUT, 'utf8')).toBe(buildBundle())
  })

  it('contains every migration, in order', () => {
    const bundle = buildBundle()
    const files = migrationFiles()
    expect(files.length).toBeGreaterThan(0)

    const positions = files.map((f) => bundle.indexOf(`\n-- ${f}\n`))
    for (const [i, pos] of positions.entries())
      expect(pos, `${files[i]} missing from the bundle`).toBeGreaterThan(-1)
    // Order matters: 0002 references what 0001 creates.
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('carries the do-not-run-against-prod warning and names the prod ref', () => {
    // The bundle is `create table` without `if not exists`, so against a
    // populated project it half-applies rather than no-ops.
    const bundle = buildBundle()
    expect(bundle).toContain('DO NOT RUN THIS AGAINST PRODUCTION')
    expect(bundle).toContain('ccbioktxfpeqaocjkqpr')
  })

  it('has no psql meta-commands, which the SQL Editor cannot run', () => {
    // \i, \set, \echo work in psql and are a syntax error in the dashboard.
    const offending = buildBundle()
      .split('\n')
      .filter((l) => /^\\/.test(l))
    expect(offending).toEqual([])
  })
})
