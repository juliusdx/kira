import { describe, it, expect } from 'vitest'
import { urlBase64ToUint8Array } from './push'

// A VAPID key that decodes wrongly fails at subscribe() with an opaque
// InvalidCharacterError, so pin the decoding rather than discovering it in a
// browser.

const REAL_KEY =
  'BMS4tOsedLcZ_ZONL61rKeu4mpTXcn7o38fAqK74Zu1jNcplZHO-kzCy4PQ9O3feQu8yntwlAD3Lre6MiAVzSgw'

describe('urlBase64ToUint8Array', () => {
  it('decodes a real VAPID public key to a 65-byte uncompressed EC point', () => {
    const out = urlBase64ToUint8Array(REAL_KEY)
    expect(out.length).toBe(65)
    expect(out[0]).toBe(0x04) // uncompressed-point marker
  })

  it('handles the base64url alphabet (- and _), not just standard base64', () => {
    // this key contains both, which plain atob would reject
    expect(REAL_KEY).toMatch(/[-_]/)
    expect(() => urlBase64ToUint8Array(REAL_KEY)).not.toThrow()
  })

  it('restores missing padding', () => {
    // 'AQAB' needs none; 'AQA' and 'AQ' need it
    expect(urlBase64ToUint8Array('AQAB').length).toBe(3)
    expect(urlBase64ToUint8Array('AQA').length).toBe(2)
    expect(urlBase64ToUint8Array('AQ').length).toBe(1)
  })

  it('is backed by a plain ArrayBuffer, as applicationServerKey requires', () => {
    const out = urlBase64ToUint8Array(REAL_KEY)
    expect(out.buffer).toBeInstanceOf(ArrayBuffer)
  })

  it('round-trips against Buffer for the same input', () => {
    const mine = Array.from(urlBase64ToUint8Array(REAL_KEY))
    const node = Array.from(Buffer.from(REAL_KEY, 'base64url'))
    expect(mine).toEqual(node)
  })
})
