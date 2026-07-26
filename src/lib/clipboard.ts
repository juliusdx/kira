/**
 * Copy text, reporting whether it actually worked.
 *
 * `navigator.clipboard` is undefined in insecure contexts (plain http on a
 * phone, some in-app webviews) and `writeText` rejects when the document is
 * not focused or permission is denied. Both failure modes are silent, so a
 * caller that assumes success will happily claim "Copied" while the user's
 * clipboard still holds whatever was there before — which is exactly how a
 * shared join code turned out to be a wall of unrelated SQL.
 *
 * Falls back to the legacy execCommand path, and returns false if neither
 * works so the UI can tell the user to copy manually.
 */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to the legacy path
    }
  }

  if (typeof document === 'undefined') return false

  const ta = document.createElement('textarea')
  try {
    ta.value = text
    ta.setAttribute('readonly', '')
    // keep it off-screen but still selectable, and avoid scrolling the page
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    // must run even if execCommand throws, or the textarea leaks into the DOM
    ta.remove()
  }
}
