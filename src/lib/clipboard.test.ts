import { describe, it, expect, vi, afterEach } from 'vitest'
import { copyText } from './clipboard'

// Regression tests for the "share code pasted unrelated SQL" bug: the copy
// silently failed, the UI still said "Copied", and the user pasted whatever
// was already on their clipboard.

function stubClipboard(impl: ((t: string) => Promise<void>) | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: impl ? { writeText: impl } : undefined,
    configurable: true,
    writable: true,
  })
}

afterEach(() => {
  stubClipboard(undefined)
  vi.restoreAllMocks()
})

describe('copyText', () => {
  it('reports success and passes the exact text through', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    stubClipboard(writeText)

    await expect(copyText('EFC1-012D-2D64')).resolves.toBe(true)
    expect(writeText).toHaveBeenCalledWith('EFC1-012D-2D64')
  })

  it('falls back when writeText REJECTS (denied / not focused)', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('NotAllowedError')))
    const exec = vi.fn().mockReturnValue(true)
    document.execCommand = exec

    await expect(copyText('CODE')).resolves.toBe(true)
    expect(exec).toHaveBeenCalledWith('copy')
  })

  it('falls back when navigator.clipboard is absent (insecure context)', async () => {
    stubClipboard(undefined)
    const exec = vi.fn().mockReturnValue(true)
    document.execCommand = exec

    await expect(copyText('CODE')).resolves.toBe(true)
    expect(exec).toHaveBeenCalled()
  })

  it('returns FALSE when nothing worked — the caller must not claim success', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('nope')))
    document.execCommand = vi.fn().mockReturnValue(false)

    await expect(copyText('CODE')).resolves.toBe(false)
  })

  it('returns false rather than throwing if execCommand itself blows up', async () => {
    stubClipboard(undefined)
    document.execCommand = () => {
      throw new Error('boom')
    }

    await expect(copyText('CODE')).resolves.toBe(false)
  })

  it('leaves no stray textarea in the DOM after the fallback runs', async () => {
    stubClipboard(undefined)
    document.execCommand = vi.fn().mockReturnValue(true)

    await copyText('CODE')
    expect(document.querySelectorAll('textarea')).toHaveLength(0)
  })
})
