import { describe, it, expect } from 'vitest'
import { AVATARS, AVATAR_TONES, avatarFor, hashSeed } from './avatar'

describe('avatarFor', () => {
  it('is stable for the same seed — a face must not change between reloads', () => {
    const a = avatarFor('user-123')
    const b = avatarFor('user-123')
    expect(a).toEqual(b)
  })

  it('gives different people different faces', () => {
    const seeds = Array.from({ length: 40 }, (_, i) => `user-${i}`)
    const faces = new Set(seeds.map((s) => avatarFor(s).emoji))
    // not a guarantee of uniqueness, but a wall of identical blanks is the
    // failure this exists to prevent
    expect(faces.size).toBeGreaterThan(5)
  })

  it('always returns something drawable, even with no seed', () => {
    for (const seed of [null, undefined, '']) {
      const look = avatarFor(seed)
      expect(AVATARS).toContain(look.emoji as (typeof AVATARS)[number])
      expect(AVATAR_TONES).toContain(look.tone as (typeof AVATAR_TONES)[number])
    }
  })

  it('a chosen face wins over the derived one', () => {
    const chosen = AVATARS[5]
    expect(avatarFor('user-123', chosen).emoji).toBe(chosen)
  })

  it('ignores a chosen value that is not one of ours', () => {
    // guards against junk in storage rendering as a broken glyph
    const look = avatarFor('user-123', '<script>')
    expect(AVATARS).toContain(look.emoji as (typeof AVATARS)[number])
  })

  it('tone follows the face, so a picked face looks deliberate', () => {
    const chosen = AVATARS[3]
    const one = avatarFor('aaa', chosen)
    const two = avatarFor('zzz', chosen)
    expect(one.tone).toBe(two.tone)
  })
})

describe('hashSeed', () => {
  it('is deterministic and unsigned', () => {
    expect(hashSeed('abc')).toBe(hashSeed('abc'))
    expect(hashSeed('abc')).toBeGreaterThanOrEqual(0)
    expect(hashSeed('abc')).not.toBe(hashSeed('abd'))
  })
})
