import { describe, it, expect } from 'vitest'
import {
  fromRemote,
  mergeReviewRows,
  pickWinner,
  rowsToPush,
  toRemote,
  type LocalReviewRow,
} from './merge'

const T0 = 1_700_000_000_000

function row(itemId: string, updatedAt: number, box = 2): LocalReviewRow {
  return { itemId, box, dueAt: updatedAt + 86_400_000, streak: 1, lastResult: true, updatedAt }
}

describe('wire format round-trip', () => {
  it('survives toRemote -> fromRemote unchanged', () => {
    const local = row('clf-001', T0, 3)
    const back = fromRemote(toRemote(local, 'user-1') as never)
    expect(back).toEqual(local)
  })

  it('serialises timestamps as ISO strings', () => {
    const wire = toRemote(row('a', T0), 'user-1')
    expect(wire.user_id).toBe('user-1')
    expect(typeof wire.due_at).toBe('string')
    expect(wire.updated_at).toBe(new Date(T0).toISOString())
  })
})

describe('pickWinner — last write wins', () => {
  it('takes whichever side is newer', () => {
    const local = row('a', T0)
    const newerRemote = row('a', T0 + 1000)
    expect(pickWinner(local, newerRemote)).toBe(newerRemote)

    const olderRemote = row('a', T0 - 1000)
    expect(pickWinner(local, olderRemote)).toBe(local)
  })

  it('prefers LOCAL on an exact tie', () => {
    const local = row('a', T0)
    const remote = row('a', T0)
    expect(pickWinner(local, remote)).toBe(local)
  })

  it('handles either side missing', () => {
    const only = row('a', T0)
    expect(pickWinner(undefined, only)).toBe(only)
    expect(pickWinner(only, undefined)).toBe(only)
    expect(pickWinner(undefined, undefined)).toBeUndefined()
  })
})

describe('mergeReviewRows', () => {
  it('returns only rows that actually changed', () => {
    const local = new Map<string, LocalReviewRow>([
      ['a', row('a', T0)],
      ['b', row('b', T0)],
    ])
    const incoming = [
      row('a', T0 + 5000), // newer -> wins
      row('b', T0 - 5000), // older -> local keeps
      row('c', T0), // unseen -> adopted
    ]
    const changed = mergeReviewRows(local, incoming)
    expect(changed.map((r) => r.itemId).sort()).toEqual(['a', 'c'])
  })

  it('is a no-op when the remote batch is stale', () => {
    const local = new Map([['a', row('a', T0)]])
    expect(mergeReviewRows(local, [row('a', T0 - 1)])).toEqual([])
  })

  it('never loses a local answer recorded during the round-trip', () => {
    // device answers at T0+9000 while a pull carrying T0+1000 is in flight
    const local = new Map([['a', row('a', T0 + 9000, 4)]])
    const inFlight = [row('a', T0 + 1000, 1)]
    expect(mergeReviewRows(local, inFlight)).toEqual([])
    expect(local.get('a')!.box).toBe(4)
  })
})

describe('rowsToPush', () => {
  it('sends only rows touched since the last sync', () => {
    const rows = [row('a', T0 - 1), row('b', T0), row('c', T0 + 1)]
    expect(rowsToPush(rows, T0).map((r) => r.itemId)).toEqual(['c'])
  })

  it('sends everything on a first sync', () => {
    const rows = [row('a', T0), row('b', T0 + 1)]
    expect(rowsToPush(rows, 0)).toHaveLength(2)
  })
})
