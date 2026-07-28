import { getMeta, setMeta } from '../db/data'
import { SYNC_ENABLED } from '../sync/client'

// The learner's own identity: a name and a face.
//
// LOCAL FIRST, like everything else here. The name used to live only in the
// Supabase `profiles` table, which meant it existed only for learners who had
// joined a class — a learner practising alone had no way to be anybody. It now
// lives in Dexie, and is pushed to the cloud as a best effort so the teacher's
// roster and the leaderboard still show it.
//
// Both travel with the account: display_name since 0001, avatar since 0006.

const NAME_KEY = 'profile.name'
const AVATAR_KEY = 'profile.avatar'

export const MAX_NAME = 24

export interface LocalProfile {
  name: string | null
  avatar: string | null
}

export async function getProfile(): Promise<LocalProfile> {
  const [name, avatar] = await Promise.all([
    getMeta<string | null>(NAME_KEY, null),
    getMeta<string | null>(AVATAR_KEY, null),
  ])
  return { name: clean(name), avatar: avatar ?? null }
}

/** Trimmed and capped the same way the server does, so the two agree. */
export function clean(name: string | null | undefined): string | null {
  const v = (name ?? '').trim().slice(0, MAX_NAME).trim()
  return v === '' ? null : v
}

export async function setName(name: string): Promise<string | null> {
  const v = clean(name)
  await setMeta(NAME_KEY, v)
  // Best effort: a learner with no network still gets their name locally, and
  // the next successful save pushes it.
  if (SYNC_ENABLED && v) {
    try {
      const { setDisplayName } = await import('../sync/classes')
      await setDisplayName(v)
    } catch {
      // offline or signed out — the local name still stands
    }
  }
  return v
}

export async function setAvatar(emoji: string): Promise<void> {
  await setMeta(AVATAR_KEY, emoji)
  if (!SYNC_ENABLED) return
  try {
    const { setAvatar: push } = await import('../sync/classes')
    await push(emoji)
  } catch {
    // offline or signed out — the local choice still stands
  }
}

/**
 * Adopt the identity stored against the account. Called once the session is
 * known, so a learner who signs in on a NEW device gets their name and face
 * back rather than starting anonymous; anything already set locally wins, so
 * this never overwrites a choice made on this device.
 */
export async function pullProfile(): Promise<LocalProfile> {
  const local = await getProfile()
  if (!SYNC_ENABLED || (local.name && local.avatar)) return local
  try {
    const { getMyProfile } = await import('../sync/classes')
    const remote = await getMyProfile()
    if (!remote) return local
    const merged: LocalProfile = {
      name: local.name ?? clean(remote.display_name),
      avatar: local.avatar ?? remote.avatar ?? null,
    }
    if (merged.name !== local.name) await setMeta(NAME_KEY, merged.name)
    if (merged.avatar !== local.avatar) await setMeta(AVATAR_KEY, merged.avatar)
    return merged
  } catch {
    return local
  }
}
