import type { SupabaseClient } from '@supabase/supabase-js'

// Sync is OPT-IN. With no credentials configured the app stays purely
// local-first and every sync entry point is a no-op — exactly how it behaves
// today.
//
// `@supabase/supabase-js` is imported DYNAMICALLY so it lands in its own chunk
// and is only ever downloaded when credentials are actually configured. A
// build without them ships none of it. (`import type` above is erased at
// compile time, so it costs nothing.)
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined

export const SYNC_ENABLED = Boolean(url && publishableKey)

let clientPromise: Promise<SupabaseClient> | null = null

export function getSupabase(): Promise<SupabaseClient> | null {
  if (!SYNC_ENABLED) return null
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(url!, publishableKey!, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          storageKey: 'kira-auth',
        },
      }),
    )
  }
  return clientPromise
}

/**
 * Anonymous auth (Spec §4: zero login friction). Reuses the persisted session
 * across launches so the learner keeps the same user id — and therefore the
 * same progress — on this device.
 */
export async function ensureSession(): Promise<string | null> {
  const pending = getSupabase()
  if (!pending) return null
  const supabase = await pending

  const { data } = await supabase.auth.getSession()
  if (data.session?.user?.id) return data.session.user.id

  const { data: signedIn, error } = await supabase.auth.signInAnonymously()
  if (error) {
    console.warn('[kira] anonymous sign-in failed', error.message)
    return null
  }
  return signedIn.user?.id ?? null
}
