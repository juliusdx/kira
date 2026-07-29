import { describe, it, expect } from 'vitest'
import { friendlyClassError } from './classErrors'
import { UI } from '../i18n/strings'

// The teacher screen used to render PostgREST's own words to a parent. These
// are the messages the classroom paths can actually produce.

describe('friendlyClassError', () => {
  it('names the network, because this is the one screen that needs it', () => {
    for (const raw of [
      'TypeError: Failed to fetch',
      'NetworkError when attempting to fetch resource.',
      'Load failed',
    ]) {
      const e = friendlyClassError(raw)
      expect(e.key, raw).toBe('errOffline')
      expect(e.offline, raw).toBe(true)
    }
  })

  it('maps a lapsed session onto identity, the recurring bug shape here', () => {
    expect(friendlyClassError('JWT expired').key).toBe('errSignedOut')
    expect(friendlyClassError('not signed in').key).toBe('errSignedOut')
  })

  it('maps every guard error the SECURITY DEFINER functions raise', () => {
    // All of them raise 42501 with their own wording.
    expect(friendlyClassError('not the owner of this class').key).toBe('errNotAllowed')
    expect(friendlyClassError('not a member of this class').key).toBe('errNotAllowed')
    expect(
      friendlyClassError('new row violates row-level security policy').key,
    ).toBe('errNotAllowed')
  })

  it('tells a learner a join code is stale rather than broken', () => {
    // join_class raises P0002 for wrong, revoked AND rotated codes alike, and
    // "rotated since it was shared" is the likely one in a real classroom.
    expect(friendlyClassError('P0002: no data found').key).toBe('errBadJoinCode')
  })

  it('recognises a migration that has not been pasted yet', () => {
    expect(friendlyClassError('PGRST202: function not found').key).toBe(
      'errBackendMissing',
    )
    expect(friendlyClassError("Could not find the table 'public.item_notes'").key).toBe(
      'errBackendMissing',
    )
  })

  it('keeps the raw text when it does not recognise a message', () => {
    // A swallowed unknown error would be invisible: the teacher screen has no
    // local fallback to notice a disagreement against.
    const e = friendlyClassError('something nobody has seen before')
    expect(e.key).toBe('errClassGeneric')
    expect(e.raw).toBe('something nobody has seen before')
  })

  it('every key it can return is a real, bilingual UI string', () => {
    const keys = [
      'errOffline',
      'errSignedOut',
      'errNotAllowed',
      'errBadJoinCode',
      'errAlreadyJoined',
      'errBackendMissing',
      'errClassGeneric',
    ] as const
    for (const k of keys) {
      expect(UI[k], k).toBeTruthy()
      expect(UI[k].en.trim(), k).not.toBe('')
      expect(UI[k].ms.trim(), k).not.toBe('')
    }
  })
})
