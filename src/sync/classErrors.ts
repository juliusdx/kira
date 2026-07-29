import type { UIKey } from '../i18n/strings'

// The classroom paths hand PostgREST's own words straight to the screen, and
// that screen belongs to a parent. "TypeError: Failed to fetch" is what being
// offline looks like today; "new row violates row-level security policy" is
// what tapping the wrong thing looks like. Same idea as authErrors.ts, applied
// to the class / roster / detail calls.
//
// Unmapped messages keep their raw text. A parent should not meet a stack
// trace, but silently swallowing an unrecognised failure would hide a real bug
// — and this is the one screen in the app where a bug is invisible otherwise,
// because there is no local fallback to compare against.

export interface FriendlyClassError {
  key: UIKey
  /** the cause is the network, not the request — worth saying so plainly */
  offline?: boolean
  /** unmapped: show this instead of pretending to understand it */
  raw?: string
}

export function friendlyClassError(raw: string): FriendlyClassError {
  const m = raw.toLowerCase()

  // fetch() rejects like this for DNS, no route, captive portals and a dropped
  // connection alike. The teacher view is the ONLY part of Kira that needs the
  // network, so this is the most likely failure a real user hits.
  if (
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    m.includes('load failed')
  ) {
    return { key: 'errOffline', offline: true }
  }

  // The session lapsed, or this device was never signed in. Identity is the
  // recurring bug shape in this project, so name it rather than saying "error".
  if (
    m.includes('jwt expired') ||
    m.includes('invalid claim') ||
    m.includes('not signed in') ||
    m.includes('no session')
  ) {
    return { key: 'errSignedOut' }
  }

  // 42501 is what every SECURITY DEFINER guard raises, plus RLS on a write.
  if (
    m.includes('42501') ||
    m.includes('row-level security') ||
    m.includes('not the owner') ||
    m.includes('not a member')
  ) {
    return { key: 'errNotAllowed' }
  }

  // join_class raises P0002 (no_data_found) on a code that is wrong, revoked,
  // or rotated since it was shared.
  if (m.includes('p0002') || m.includes('no data found') || m.includes('invalid code')) {
    return { key: 'errBadJoinCode' }
  }

  if (m.includes('duplicate key') || m.includes('already a member')) {
    return { key: 'errAlreadyJoined' }
  }

  // PGRST202 = the function is not there. In this project that means a
  // migration has not been pasted yet, which is a state the app can genuinely
  // be in between a deploy and a visit to the SQL Editor.
  if (m.includes('pgrst202') || m.includes('pgrst205') || m.includes('could not find')) {
    return { key: 'errBackendMissing' }
  }

  return { key: 'errClassGeneric', raw }
}

/**
 * Is the browser reporting no connection?
 *
 * `navigator.onLine` only ever proves the NEGATIVE — true means "there is a
 * network interface", not "the internet works", which is why a failed request
 * is still mapped on its own message above rather than being trusted to this.
 */
export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false
}
