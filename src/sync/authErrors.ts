import type { UIKey } from '../i18n/strings'

// Supabase returns raw, developer-facing auth messages ("Signups not allowed
// for otp") that mean nothing to a learner. Map the ones we can actually hit
// onto a localized string, and say which of the two flows fixes it.

export interface FriendlyAuthError {
  key: UIKey
  /** the user is on the wrong flow; offer to switch to linking */
  suggestLink?: boolean
  /** unmapped — show the raw text so a real bug is still visible */
  raw?: string
}

export function friendlyAuthError(raw: string): FriendlyAuthError {
  const m = raw.toLowerCase()

  // signInWithOtp({shouldCreateUser: false}) against an email that has no
  // account: the user meant "save my progress", not "sign in".
  if (m.includes('signups not allowed') || m.includes('user not found')) {
    return { key: 'errNoAccount', suggestLink: true }
  }
  if (m.includes('already been registered') || m.includes('already exists')) {
    return { key: 'errEmailTaken' }
  }
  if (m.includes('token has expired') || m.includes('invalid token') || m.includes('otp_expired')) {
    return { key: 'errBadCode' }
  }
  if (m.includes('rate limit') || m.includes('you can only request this after')) {
    return { key: 'errRateLimited' }
  }
  if (m.includes('email_address_invalid') || m.includes('is invalid')) {
    return { key: 'errBadEmail' }
  }
  return { key: 'errBadCode', raw }
}
