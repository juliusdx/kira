import { describe, it, expect } from 'vitest'
import { friendlyAuthError } from './authErrors'

describe('friendlyAuthError', () => {
  it('maps the real message seen when signing in with an unlinked email', () => {
    // exactly what Supabase returned in the reported case
    const e = friendlyAuthError('Signups not allowed for otp')
    expect(e.key).toBe('errNoAccount')
    expect(e.suggestLink).toBe(true) // must offer the flow that actually works
    expect(e.raw).toBeUndefined()
  })

  it('maps an email already attached to another account', () => {
    expect(
      friendlyAuthError('A user with this email address has already been registered').key,
    ).toBe('errEmailTaken')
  })

  it('maps an expired or wrong OTP', () => {
    expect(friendlyAuthError('Token has expired or is invalid').key).toBe('errBadCode')
  })

  it('maps rate limiting', () => {
    expect(friendlyAuthError('email rate limit exceeded').key).toBe('errRateLimited')
    expect(
      friendlyAuthError('For security purposes, you can only request this after 51 seconds').key,
    ).toBe('errRateLimited')
  })

  it('maps an invalid address', () => {
    expect(friendlyAuthError('Email address "" is invalid').key).toBe('errBadEmail')
  })

  it('keeps the raw text for unmapped errors so real bugs stay visible', () => {
    const e = friendlyAuthError('some brand new failure')
    expect(e.raw).toBe('some brand new failure')
    expect(e.suggestLink).toBeUndefined()
  })

  it('is case-insensitive', () => {
    expect(friendlyAuthError('SIGNUPS NOT ALLOWED FOR OTP').key).toBe('errNoAccount')
  })
})
