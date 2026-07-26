import { getSupabase, SYNC_ENABLED } from './client'

// Durable identity (Build Spec §4: "allow upgrade to email later so progress
// binds to an account"). Learners start anonymous; linking an email converts
// the SAME anonymous user into a permanent one — the user id never changes, so
// every review_state / attempts / membership row is preserved untouched. On a
// new device, signing in with that email returns to the same account and the
// normal pull restores everything.
//
// We use OTP codes (not magic links): a code the user types back is far more
// robust than a deep link inside a PWA served from a project sub-path.

export interface Identity {
  userId: string
  email: string | null
  /** true until an email has been linked */
  isAnonymous: boolean
}

export interface AuthResult {
  ok: boolean
  error?: string
}

function message(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Current identity, or null when sync is disabled / not signed in. */
export async function getIdentity(): Promise<Identity | null> {
  const pending = getSupabase()
  if (!pending) return null
  const supabase = await pending
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return null
  return {
    userId: user.id,
    email: user.email ?? null,
    // Supabase marks converted users is_anonymous = false and sets email.
    isAnonymous: Boolean(user.is_anonymous) || !user.email,
  }
}

/**
 * Step 1 of linking an email to the current (anonymous) account. Sends a
 * one-time code to `email`. The user id is unchanged by this call.
 */
export async function startEmailLink(email: string): Promise<AuthResult> {
  const pending = getSupabase()
  if (!pending) return { ok: false, error: 'sync-disabled' }
  try {
    const supabase = await pending
    const { error } = await supabase.auth.updateUser({ email: email.trim() })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e) }
  }
}

/**
 * Step 2 of linking: verify the code. On success the anonymous user becomes
 * permanent with this email, keeping the same id (and thus all progress).
 */
export async function confirmEmailLink(
  email: string,
  token: string,
): Promise<AuthResult> {
  const pending = getSupabase()
  if (!pending) return { ok: false, error: 'sync-disabled' }
  try {
    const supabase = await pending
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'email_change',
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e) }
  }
}

/**
 * Step 1 of signing in on a NEW device (or after data was cleared). Sends a
 * code to an email that has already been linked. `shouldCreateUser: false`
 * means a typo or unknown address fails instead of silently minting a new,
 * empty account.
 */
export async function startEmailSignIn(email: string): Promise<AuthResult> {
  const pending = getSupabase()
  if (!pending) return { ok: false, error: 'sync-disabled' }
  try {
    const supabase = await pending
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e) }
  }
}

/**
 * Step 2 of signing in: verify the code. Switches this device to the existing
 * account. The caller should re-pull afterwards to restore progress.
 */
export async function confirmEmailSignIn(
  email: string,
  token: string,
): Promise<AuthResult> {
  const pending = getSupabase()
  if (!pending) return { ok: false, error: 'sync-disabled' }
  try {
    const supabase = await pending
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: token.trim(),
      type: 'email',
    })
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: message(e) }
  }
}

/**
 * Re-read the identity from the server after the user confirmed by clicking
 * the link in the email rather than typing a code.
 *
 * Supabase's default "Change Email Address" template sends a
 * {{ .ConfirmationURL }} link and no {{ .Token }}, so there may be no code to
 * type. Clicking the link applies the change server-side, but this device's
 * JWT still carries the old claims until the session is refreshed.
 */
export async function refreshIdentity(): Promise<Identity | null> {
  const pending = getSupabase()
  if (!pending) return null
  const supabase = await pending
  // pulls a new JWT reflecting the confirmed email
  await supabase.auth.refreshSession()
  return getIdentity()
}

/** Sign out on this device. Progress stays in IndexedDB; sync just pauses. */
export async function signOut(): Promise<void> {
  if (!SYNC_ENABLED) return
  const pending = getSupabase()
  if (!pending) return
  const supabase = await pending
  await supabase.auth.signOut()
}
