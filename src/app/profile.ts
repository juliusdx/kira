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
// The avatar is local-only for now; migration 0006 adds the column that lets it
// travel with the account.

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
}
