import { getSupabase } from './client'
import {
  ALL_ENTRIES,
  MECHANIC_SKILL_TAGS,
  getEntry,
  lessonOf,
  topicOf,
} from '../content/loader'
import { computeProgress, type TopicProgress } from '../app/progress'
import { masteryWeight, type ReviewState } from '../scheduler/scheduler'
import type { Item, LocalizedText } from '../content/types'

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
  /** the face the learner chose; null means fall back to the derived one */
  avatar: string | null
  joinedAt: string
  /** null when the learner has not synced anything yet */
  lastActiveAt: string | null
  seen: number
  mastered: number
  due: number
  masteryPct: number
  accuracyPct: number | null
  attempts: number
}

/** One row of `class_roster` (migration 0005) — already aggregated in Postgres. */
export interface RosterRow {
  user_id: string
  display_name: string | null
  avatar: string | null
  joined_at: string
  last_active_at: string | null
  seen: number
  mastered: number
  due: number
  /** counts for boxes 1..5, so the weighting rule stays in scheduler.ts */
  box_counts: number[]
  attempts: number
  correct: number
}

/** One row of `learner_item_stats` (migration 0005) — one per item touched. */
export interface ItemStatRow {
  item_id: string
  box: number | null
  due_at: string | null
  attempts: number
  wrong: number
  last_wrong_at: string | null
  last_at: string | null
}

const TOTAL_ITEMS = ALL_ENTRIES.length
const SKILLS_BY_ITEM = new Map(
  ALL_ENTRIES.map((e) => [e.item.id, e.item.skill_tags ?? []]),
)

/**
 * How many OTHER items drill any of this item's teachable skills — the answer
 * to "is there more practice on this already, or does it need authoring?".
 * Mechanic tags are ignored: every faded_step shares `faded-step`, which would
 * make the count say "30 more like this" about the presentation, not the skill.
 */
export function siblingCount(itemId: string): number {
  const tags = (SKILLS_BY_ITEM.get(itemId) ?? []).filter(
    (tag) => !MECHANIC_SKILL_TAGS.has(tag),
  )
  if (!tags.length) return 0
  let n = 0
  for (const e of ALL_ENTRIES) {
    if (e.item.id === itemId) continue
    if ((e.item.skill_tags ?? []).some((tag) => tags.includes(tag))) n++
  }
  return n
}

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

export interface LeaderRow {
  userId: string
  displayName: string
  avatar: string | null
  score: number
}

/**
 * Class ranking over the last `days`. Served by a SECURITY DEFINER function so
 * classmates see ranks WITHOUT gaining read access to each other's answers —
 * the underlying tables stay locked down.
 */
export async function getLeaderboard(
  classId: string,
  days = 7,
): Promise<LeaderRow[]> {
  const pending = getSupabase()
  if (!pending) return []
  const supabase = await pending
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await supabase.rpc('class_leaderboard', {
    p_class_id: classId,
    p_since: since,
  })
  if (error) throw new Error(error.message)
  return (
    (data ?? []) as {
      user_id: string
      display_name: string
      avatar: string | null
      score: number
    }[]
  ).map((r) => ({
    userId: r.user_id,
    displayName: r.display_name,
    avatar: r.avatar ?? null,
    score: Number(r.score),
  }))
}

/** Set your own display name (max 24 chars, trimmed server-side). */
export async function setDisplayName(name: string): Promise<string | null> {
  const pending = getSupabase()
  if (!pending) throw new Error('sync disabled')
  const supabase = await pending
  const { data, error } = await supabase.rpc('set_display_name', {
    p_name: name,
  })
  if (error) throw new Error(error.message)
  return (data as string | null) ?? null
}

/** Store the learner's chosen face. The DB allow-list rejects anything else. */
export async function setAvatar(emoji: string): Promise<string | null> {
  const pending = getSupabase()
  if (!pending) throw new Error('sync disabled')
  const supabase = await pending
  const { data, error } = await supabase.rpc('set_avatar', { p_avatar: emoji })
  if (error) throw new Error(error.message)
  return (data as string | null) ?? null
}

/** The signed-in learner's own profile row, for restoring it on a new device. */
export async function getMyProfile(): Promise<{
  display_name: string | null
  avatar: string | null
} | null> {
  const pending = getSupabase()
  if (!pending) return null
  const supabase = await pending
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('display_name, avatar')
    .eq('id', auth.user.id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as { display_name: string | null; avatar: string | null } | null) ?? null
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

/**
 * Leave a class you joined. The learner's own progress is untouched — only the
 * membership row goes, so the teacher stops seeing them. Allowed by the
 * "leave or be removed" policy from migration 0002.
 */
export async function leaveClass(classId: string): Promise<void> {
  const pending = getSupabase()
  if (!pending) throw new Error('sync disabled')
  const supabase = await pending
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('not signed in')
  const { error } = await supabase
    .from('class_members')
    .delete()
    .eq('class_id', classId)
    .eq('user_id', auth.user.id)
  if (error) throw new Error(error.message)
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
 * Roster for one class, one row per learner.
 *
 * Aggregated in Postgres by `class_roster` (migration 0005) rather than here.
 * The old client-side version fetched every review_state row and every attempt
 * for every member, which PostgREST silently truncates at the project's "Max
 * rows" cap — so the numbers quietly went wrong as soon as a class was real.
 */
export async function getClassRoster(classId: string): Promise<LearnerSummary[]> {
  const pending = getSupabase()
  if (!pending) return []
  const supabase = await pending

  const { data, error } = await supabase.rpc('class_roster', {
    p_class_id: classId,
  })
  if (error) throw new Error(error.message)
  return mapRosterRows((data ?? []) as RosterRow[])
}

/**
 * Pure mapping of aggregated rows into summaries. Separate from the network
 * call so it can be unit-tested, and so the mastery WEIGHTING stays here in
 * TypeScript next to scheduler.ts rather than being duplicated in SQL.
 */
export function mapRosterRows(rows: RosterRow[]): LearnerSummary[] {
  return rows.map((r) => {
    // box_counts[i] is the number of items sitting in box i+1
    const weightSum = (r.box_counts ?? []).reduce(
      (sum, n, i) => sum + Number(n) * boxWeight(i + 1),
      0,
    )
    const attempts = Number(r.attempts)
    const correct = Number(r.correct)
    return {
      userId: r.user_id,
      displayName: r.display_name?.trim() ? r.display_name : null,
      avatar: r.avatar ?? null,
      joinedAt: r.joined_at,
      lastActiveAt: r.last_active_at,
      seen: Number(r.seen),
      mastered: Number(r.mastered),
      due: Number(r.due),
      // denominator is the whole content set, matching the learner's own
      // Progress screen
      masteryPct: TOTAL_ITEMS ? Math.round((weightSum / TOTAL_ITEMS) * 100) : 0,
      accuracyPct: attempts ? Math.round((correct / attempts) * 100) : null,
      attempts,
    }
  })
}

/** Mastery weight of a single box, via the scheduler so the rule has one home. */
function boxWeight(box: number): number {
  return masteryWeight({
    box,
    dueAt: 0,
    streak: 0,
    lastResult: null,
    updatedAt: 0,
  })
}

// --- one learner, in detail ------------------------------------------------

export interface WeakSkill {
  tag: string
  attempts: number
  wrong: number
  wrongPct: number
}

export interface RecentMiss {
  itemId: string
  prompt: LocalizedText
  topicTitle: LocalizedText | null
  wrong: number
  lastWrongAt: string
  /**
   * The whole authored item, so the teacher can be shown the question the
   * learner actually saw — the answer, the explanation, the lot. It costs
   * nothing to carry: content is bundled locally, so a miss only ever needed
   * the item ID from the server. Null once content is removed after an
   * attempt.
   */
  item: Item | null
  lessonTitle: LocalizedText | null
  /** Other items in the bank drilling the same skills — what to practise next. */
  siblings: number
  /**
   * What the learner last answered (migration 0007), as opaque jsonb — only
   * the client knows the shape, so `lib/chosenAnswer.ts` reads it.
   * `undefined` means we were not told (0007 not applied yet, or no wrong
   * attempt recorded); `null` means the attempt predates syncing `chosen`.
   */
  chosen?: unknown
}

export interface LearnerDetail {
  topics: TopicProgress[]
  overallPct: number
  seen: number
  attempts: number
  accuracyPct: number | null
  weakest: WeakSkill[]
  recentMisses: RecentMiss[]
}

/**
 * Everything behind one learner's row: which TOPICS are weak, not just that
 * the learner is struggling. Bounded by the content bank (one row per item
 * touched), so unlike raw attempts it cannot outgrow the row cap.
 */
export async function getLearnerDetail(
  classId: string,
  userId: string,
  now: number = Date.now(),
): Promise<LearnerDetail> {
  const pending = getSupabase()
  if (!pending) return emptyDetail(now)
  const supabase = await pending

  const [stats, lastWrong] = await Promise.all([
    supabase.rpc('learner_item_stats', { p_class_id: classId, p_user_id: userId }),
    // Migration 0007 is applied BY HAND, so a deploy reaches users before the
    // function exists. Treat its absence as "no answers recorded" rather than
    // failing the whole detail screen — the rest of the report is unaffected.
    supabase
      .rpc('learner_last_wrong', { p_class_id: classId, p_user_id: userId })
      .then((r) => (r.error ? { data: null, error: null } : r)),
  ])
  if (stats.error) throw new Error(stats.error.message)

  return rollUpDetail(
    (stats.data ?? []) as ItemStatRow[],
    now,
    (lastWrong.data ?? []) as LastWrongRow[],
  )
}

/** One row of `learner_last_wrong` (migration 0007). */
export interface LastWrongRow {
  item_id: string
  chosen: unknown
  wrong_at: string
}

function emptyDetail(now: number): LearnerDetail {
  const p = computeProgress(new Map(), now)
  return {
    topics: p.topics,
    overallPct: p.overallPct,
    seen: 0,
    attempts: 0,
    accuracyPct: null,
    weakest: [],
    recentMisses: [],
  }
}

/** Pure roll-up of one learner's per-item rows. Unit-tested. */
export function rollUpDetail(
  rows: ItemStatRow[],
  now: number,
  lastWrong: LastWrongRow[] = [],
): LearnerDetail {
  // Reuse the learner's OWN progress computation, so a teacher and a learner
  // can never be looking at two different definitions of the same number.
  const reviewMap = new Map<string, ReviewState>()
  for (const r of rows) {
    if (r.box == null) continue
    reviewMap.set(r.item_id, {
      box: Number(r.box),
      dueAt: r.due_at ? Date.parse(r.due_at) : 0,
      streak: 0,
      lastResult: null,
      updatedAt: r.last_at ? Date.parse(r.last_at) : 0,
    })
  }
  const progress = computeProgress(reviewMap, now)

  let attempts = 0
  let wrongTotal = 0
  for (const r of rows) {
    attempts += Number(r.attempts)
    wrongTotal += Number(r.wrong)
  }

  return {
    topics: progress.topics,
    overallPct: progress.overallPct,
    seen: progress.seenCount,
    attempts,
    accuracyPct: attempts
      ? Math.round(((attempts - wrongTotal) / attempts) * 100)
      : null,
    weakest: weakestSkills(rows),
    recentMisses: recentMisses(rows, 5, lastWrong),
  }
}

/**
 * Skill tags the learner gets wrong most often (min 3 attempts), worst first.
 *
 * MECHANIC tags are excluded: `faded-step` describes how a question is
 * presented, not anything a learner can be weak at, and reporting it as a
 * "weakest skill" to a parent is just noise.
 */
const MECHANIC_TAGS = new Set(['faded-step'])

/**
 * A tag has to be BOTH well-evidenced and actually going badly to be called
 * "needs work". Ranking by error rate alone and taking the top 3 promoted
 * whatever was least-bad into a list headed "Needs work" — a learner at 1
 * wrong in 10 was being reported as weak at the thing she is best at, which
 * would send a parent to drill exactly the wrong topic.
 */
const MIN_ATTEMPTS = 4
const MIN_WRONG_PCT = 30

export function weakestSkills(rows: ItemStatRow[], max = 3): WeakSkill[] {
  const tally = new Map<string, { n: number; wrong: number }>()
  for (const r of rows) {
    const n = Number(r.attempts)
    if (!n) continue
    for (const tag of SKILLS_BY_ITEM.get(r.item_id) ?? []) {
      if (MECHANIC_TAGS.has(tag)) continue
      const t = tally.get(tag) ?? { n: 0, wrong: 0 }
      t.n += n
      t.wrong += Number(r.wrong)
      tally.set(tag, t)
    }
  }
  return [...tally.entries()]
    .map(([tag, t]) => ({
      tag,
      attempts: t.n,
      wrong: t.wrong,
      wrongPct: Math.round((t.wrong / t.n) * 100),
    }))
    .filter((w) => w.attempts >= MIN_ATTEMPTS && w.wrongPct >= MIN_WRONG_PCT)
    .sort((a, b) => b.wrongPct - a.wrongPct || b.wrong - a.wrong)
    .slice(0, max)
}

/** The items most recently got wrong — what to actually sit down and go over. */
export function recentMisses(
  rows: ItemStatRow[],
  max = 5,
  lastWrong: LastWrongRow[] = [],
): RecentMiss[] {
  const chosenByItem = new Map(lastWrong.map((r) => [r.item_id, r.chosen]))
  return rows
    .filter((r) => Number(r.wrong) > 0 && r.last_wrong_at)
    .sort((a, b) => Date.parse(b.last_wrong_at!) - Date.parse(a.last_wrong_at!))
    .slice(0, max)
    .map((r) => {
      const entry = getEntry(r.item_id)
      return {
        itemId: r.item_id,
        // an id with no entry means content was removed after the attempt
        prompt: entry?.item.prompt ?? { en: r.item_id, ms: r.item_id },
        topicTitle: topicOf(r.item_id)?.title ?? null,
        wrong: Number(r.wrong),
        lastWrongAt: r.last_wrong_at!,
        item: entry?.item ?? null,
        lessonTitle: lessonOf(r.item_id)?.title ?? null,
        siblings: siblingCount(r.item_id),
        // undefined = migration 0007 not applied (or no answer recorded);
        // null = an attempt written before the client ever synced `chosen`.
        chosen: chosenByItem.has(r.item_id) ? chosenByItem.get(r.item_id) : undefined,
      }
    })
}
