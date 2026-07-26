import { getSupabase } from './client'
import { ALL_ENTRIES } from '../content/loader'
import { isDue, masteryWeight, type ReviewState } from '../scheduler/scheduler'

// Classroom data access (migration 0002). Everything here is gated by RLS on
// the server: a teacher only ever receives rows for learners who themselves
// joined one of that teacher's classes.

export interface ClassRow {
  id: string
  name: string
  join_code: string
  created_at: string
}

export interface LearnerSummary {
  userId: string
  displayName: string | null
  joinedAt: string
  /** null when the learner has not synced anything yet */
  lastActiveAt: string | null
  seen: number
  mastered: number
  due: number
  masteryPct: number
  accuracyPct: number | null
  attempts: number
  /** skill tags with the worst accuracy, worst first (max 3) */
  weakestSkills: string[]
}

interface RemoteReview {
  user_id: string
  item_id: string
  box: number
  due_at: string
  updated_at: string
}

interface RemoteAttempt {
  user_id: string
  item_id: string
  correct: boolean
  created_at: string
}

const TOTAL_ITEMS = ALL_ENTRIES.length
const SKILLS_BY_ITEM = new Map(
  ALL_ENTRIES.map((e) => [e.item.id, e.item.skill_tags ?? []]),
)

/** Classes owned by the signed-in teacher. */
export async function listMyClasses(): Promise<ClassRow[]> {
  const pending = getSupabase()
  if (!pending) return []
  const supabase = await pending
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []

  const { data, error } = await supabase
    .from('classes')
    .select('id, name, join_code, created_at')
    .eq('owner_id', auth.user.id)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as ClassRow[]
}

export async function createClass(name: string): Promise<ClassRow> {
  const pending = getSupabase()
  if (!pending) throw new Error('sync disabled')
  const supabase = await pending
  const { data, error } = await supabase.rpc('create_class', { p_name: name })
  if (error) throw new Error(error.message)
  return data as ClassRow
}

/** Join a class as a learner. Returns the class id. */
export async function joinClass(code: string): Promise<string> {
  const pending = getSupabase()
  if (!pending) throw new Error('sync disabled')
  const supabase = await pending
  const { data, error } = await supabase.rpc('join_class', { p_code: code })
  if (error) throw new Error(error.message)
  return data as string
}

/** Issue a fresh join code for a class you own; the old code stops working. */
export async function rotateJoinCode(classId: string): Promise<string> {
  const pending = getSupabase()
  if (!pending) throw new Error('sync disabled')
  const supabase = await pending
  const { data, error } = await supabase.rpc('rotate_join_code', {
    p_class_id: classId,
  })
  if (error) throw new Error(error.message)
  return data as string
}

/** Classes the signed-in learner has joined. */
export async function listJoinedClasses(): Promise<ClassRow[]> {
  const pending = getSupabase()
  if (!pending) return []
  const supabase = await pending
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return []

  // RLS lets a member read their own membership rows and the class itself.
  const { data, error } = await supabase
    .from('class_members')
    .select('classes ( id, name, join_code, created_at )')
    .eq('user_id', auth.user.id)
  if (error) throw new Error(error.message)
  // PostgREST types an embedded relation as an array even when the FK makes it
  // at most one row, so normalise both shapes.
  return (data ?? [])
    .flatMap((r) => {
      const embedded = (r as unknown as { classes: ClassRow | ClassRow[] | null })
        .classes
      if (!embedded) return []
      return Array.isArray(embedded) ? embedded : [embedded]
    })
    .filter((c): c is ClassRow => Boolean(c))
}

export async function removeMember(
  classId: string,
  userId: string,
): Promise<void> {
  const pending = getSupabase()
  if (!pending) throw new Error('sync disabled')
  const supabase = await pending
  const { error } = await supabase
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

/**
 * Roster for one class, with each learner's progress rolled up.
 *
 * Three queries rather than one per learner: memberships, then all their
 * review_state rows, then all their attempts — each scoped by RLS.
 */
export async function getClassRoster(
  classId: string,
  now: number = Date.now(),
): Promise<LearnerSummary[]> {
  const pending = getSupabase()
  if (!pending) return []
  const supabase = await pending

  const { data: members, error: mErr } = await supabase
    .from('class_members')
    .select('user_id, joined_at, profiles ( display_name )')
    .eq('class_id', classId)
  if (mErr) throw new Error(mErr.message)
  if (!members?.length) return []

  const ids = members.map((m) => (m as { user_id: string }).user_id)

  const [{ data: reviews, error: rErr }, { data: attempts, error: aErr }] =
    await Promise.all([
      supabase
        .from('review_state')
        .select('user_id, item_id, box, due_at, updated_at')
        .in('user_id', ids),
      supabase
        .from('attempts')
        .select('user_id, item_id, correct, created_at')
        .in('user_id', ids),
    ])
  if (rErr) throw new Error(rErr.message)
  if (aErr) throw new Error(aErr.message)

  return rollUp(
    members as unknown as {
      user_id: string
      joined_at: string
      profiles: { display_name: string | null } | null
    }[],
    (reviews ?? []) as RemoteReview[],
    (attempts ?? []) as RemoteAttempt[],
    now,
  )
}

/**
 * Pure roll-up of raw rows into per-learner summaries. Split out from the
 * network call so it can be unit-tested.
 */
export function rollUp(
  members: {
    user_id: string
    joined_at: string
    profiles: { display_name: string | null } | null
  }[],
  reviews: RemoteReview[],
  attempts: RemoteAttempt[],
  now: number,
): LearnerSummary[] {
  const byUserReviews = new Map<string, RemoteReview[]>()
  for (const r of reviews) {
    const list = byUserReviews.get(r.user_id)
    if (list) list.push(r)
    else byUserReviews.set(r.user_id, [r])
  }

  const byUserAttempts = new Map<string, RemoteAttempt[]>()
  for (const a of attempts) {
    const list = byUserAttempts.get(a.user_id)
    if (list) list.push(a)
    else byUserAttempts.set(a.user_id, [a])
  }

  return members
    .map((m) => {
      const rs = byUserReviews.get(m.user_id) ?? []
      const as = byUserAttempts.get(m.user_id) ?? []

      let mastered = 0
      let due = 0
      let weightSum = 0
      let lastActive = 0

      for (const r of rs) {
        if (r.box >= 5) mastered++
        const state: ReviewState = {
          box: r.box,
          dueAt: Date.parse(r.due_at),
          streak: 0,
          lastResult: null,
          updatedAt: Date.parse(r.updated_at),
        }
        if (isDue(state, now)) due++
        weightSum += masteryWeight(state)
        lastActive = Math.max(lastActive, state.updatedAt)
      }
      for (const a of as) {
        lastActive = Math.max(lastActive, Date.parse(a.created_at))
      }

      const correct = as.filter((a) => a.correct).length

      return {
        userId: m.user_id,
        displayName: m.profiles?.display_name ?? null,
        joinedAt: m.joined_at,
        lastActiveAt: lastActive ? new Date(lastActive).toISOString() : null,
        seen: rs.length,
        mastered,
        due,
        // denominator is the whole content set, matching the learner's own
        // Progress screen
        masteryPct: TOTAL_ITEMS
          ? Math.round((weightSum / TOTAL_ITEMS) * 100)
          : 0,
        accuracyPct: as.length ? Math.round((correct / as.length) * 100) : null,
        attempts: as.length,
        weakestSkills: weakestSkills(as),
      }
    })
    .sort((a, b) => {
      // most recently active first; never-active last
      const at = a.lastActiveAt ? Date.parse(a.lastActiveAt) : -1
      const bt = b.lastActiveAt ? Date.parse(b.lastActiveAt) : -1
      return bt - at
    })
}

/** Skill tags with the worst accuracy (min 3 attempts), worst first, max 3. */
function weakestSkills(attempts: RemoteAttempt[]): string[] {
  const tally = new Map<string, { n: number; wrong: number }>()
  for (const a of attempts) {
    for (const tag of SKILLS_BY_ITEM.get(a.item_id) ?? []) {
      const t = tally.get(tag) ?? { n: 0, wrong: 0 }
      t.n++
      if (!a.correct) t.wrong++
      tally.set(tag, t)
    }
  }
  return [...tally.entries()]
    .filter(([, t]) => t.n >= 3 && t.wrong > 0)
    .sort((a, b) => b[1].wrong / b[1].n - a[1].wrong / a[1].n)
    .slice(0, 3)
    .map(([tag]) => tag)
}
