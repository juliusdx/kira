import { describe, it, expect } from 'vitest'
import { MAX_NAME, clean } from './profile'

describe('clean', () => {
  it('trims and treats blank as no name', () => {
    expect(clean('  Ariel  ')).toBe('Ariel')
    expect(clean('')).toBeNull()
    expect(clean('   ')).toBeNull()
    expect(clean(null)).toBeNull()
    expect(clean(undefined)).toBeNull()
  })

  it('caps at the same length the server does, so the two agree', () => {
    const long = 'x'.repeat(MAX_NAME + 10)
    expect(clean(long)).toHaveLength(MAX_NAME)
  })

  it('does not leave a trailing space when the cap lands mid-word', () => {
    // set_display_name() on the server is left(...) then btrim, so a name cut
    // at a space must not come back with one attached
    const name = 'a'.repeat(MAX_NAME - 1) + ' bcd'
    expect(clean(name)).toBe('a'.repeat(MAX_NAME - 1))
  })
})
