import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { recordProbeUser } from './probeUsers'

// The ledger is what makes cleaning up after an integration run a LOOKUP
// rather than a guess — without it the only way to find a leftover probe is by
// its footprint, which a real learner who has not practised yet also matches.

const LEDGER = join(tmpdir(), `kira-probe-ledger-${process.pid}.local`)

afterEach(() => {
  delete process.env.KIRA_PROBE_LEDGER
  if (existsSync(LEDGER)) rmSync(LEDGER)
})

describe('recordProbeUser', () => {
  it('appends every id, so ids survive across runs until cleaned up', () => {
    process.env.KIRA_PROBE_LEDGER = LEDGER
    recordProbeUser('11111111-1111-1111-1111-111111111111', 'teacher')
    recordProbeUser('22222222-2222-2222-2222-222222222222', 'learner')

    const lines = readFileSync(LEDGER, 'utf8').trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toContain('11111111-1111-1111-1111-111111111111')
    expect(lines[0]).toContain('teacher')
    expect(lines[1]).toContain('22222222-2222-2222-2222-222222222222')
    // a timestamp, so a run can be matched against when it happened
    expect(lines[0].split('\t')[0]).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  // A verification run is expensive and hits production; losing it over a
  // failed file write would be a bad trade for a line of bookkeeping.
  it('never throws when the ledger cannot be written', () => {
    process.env.KIRA_PROBE_LEDGER = '/nonexistent-dir/nope/ledger.local'
    expect(() => recordProbeUser('33333333-3333-3333-3333-333333333333', 'x')).not.toThrow()
  })
})
