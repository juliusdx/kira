import { CONTENT } from '../content/loader'
import type { LocalizedText } from '../content/types'
import { isDue, MAX_BOX, type ReviewState } from '../scheduler/scheduler'

// Badges are DERIVED, never stored.
//
// Every one is computed from review_state + attempts, which already sync, so a
// learner's badges follow their account to a new device for free — no extra
// table, no extra migration, and nothing to keep consistent with the cloud.
// That constraint is why there is no "perfect session" badge: attempts carry no
// session id, so it could not be recomputed. "Best run" measures the same
// instinct from data we actually have.

export interface AttemptLite {
  itemId: string
  correct: boolean
  createdAt: number
}

export interface Badge {
  id: string
  emoji: string
  name: LocalizedText
  desc: LocalizedText
  earned: boolean
  /** for unearned badges with a countable target */
  have?: number
  need?: number
}

/** Longest run of consecutive correct answers, ever. */
export function bestRun(attempts: AttemptLite[]): number {
  const sorted = [...attempts].sort((a, b) => a.createdAt - b.createdAt)
  let best = 0
  let run = 0
  for (const a of sorted) {
    run = a.correct ? run + 1 : 0
    if (run > best) best = run
  }
  return best
}

/**
 * An item that was wrong at least twice and is now well established. This is
 * the badge worth having — it means the scheduler and the self-explanation
 * gate did their job on something the learner genuinely had backwards.
 */
export function comebackCount(
  attempts: AttemptLite[],
  reviewMap: Map<string, ReviewState>,
): number {
  const wrong = new Map<string, number>()
  for (const a of attempts) {
    if (!a.correct) wrong.set(a.itemId, (wrong.get(a.itemId) ?? 0) + 1)
  }
  let n = 0
  for (const [itemId, misses] of wrong) {
    if (misses >= 2 && (reviewMap.get(itemId)?.box ?? 0) >= 4) n++
  }
  return n
}

function count(
  id: string,
  emoji: string,
  name: LocalizedText,
  desc: LocalizedText,
  have: number,
  need: number,
): Badge {
  return { id, emoji, name, desc, earned: have >= need, have, need }
}

export function computeBadges(
  reviewMap: Map<string, ReviewState>,
  attempts: AttemptLite[],
  now: number,
): Badge[] {
  let mastered = 0
  let seen = 0
  let due = 0
  for (const state of reviewMap.values()) {
    seen++
    if (state.box >= MAX_BOX) mastered++
    if (isDue(state, now)) due++
  }

  const run = bestRun(attempts)
  const comebacks = comebackCount(attempts, reviewMap)
  const total = attempts.length

  const badges: Badge[] = [
    count(
      'first-mastery',
      '🌱',
      { en: 'First mastery', ms: 'Penguasaan pertama' },
      { en: 'Get one item to the top box', ms: 'Bawa satu item ke kotak teratas' },
      mastered,
      1,
    ),
    count(
      'mastered-10',
      '📗',
      { en: 'Ten mastered', ms: 'Sepuluh dikuasai' },
      { en: 'Master 10 items', ms: 'Kuasai 10 item' },
      mastered,
      10,
    ),
    count(
      'mastered-25',
      '📘',
      { en: 'Twenty-five mastered', ms: 'Dua puluh lima dikuasai' },
      { en: 'Master 25 items', ms: 'Kuasai 25 item' },
      mastered,
      25,
    ),
    count(
      'mastered-50',
      '🏆',
      { en: 'Fifty mastered', ms: 'Lima puluh dikuasai' },
      { en: 'Master 50 items', ms: 'Kuasai 50 item' },
      mastered,
      50,
    ),
    count(
      'run-10',
      '🔥',
      { en: 'Ten in a row', ms: 'Sepuluh berturut' },
      { en: '10 correct answers in a row', ms: '10 jawapan betul berturut-turut' },
      run,
      10,
    ),
    count(
      'run-25',
      '⚡',
      { en: 'Twenty-five in a row', ms: 'Dua puluh lima berturut' },
      { en: '25 correct answers in a row', ms: '25 jawapan betul berturut-turut' },
      run,
      25,
    ),
    count(
      'comeback',
      '💪',
      { en: 'Comeback', ms: 'Bangkit semula' },
      {
        en: 'Master something you got wrong twice',
        ms: 'Kuasai sesuatu yang anda salah dua kali',
      },
      comebacks,
      1,
    ),
    count(
      'century',
      '💯',
      { en: 'Century', ms: 'Seratus' },
      { en: 'Answer 100 questions', ms: 'Jawab 100 soalan' },
      total,
      100,
    ),
    {
      id: 'caught-up',
      emoji: '✅',
      name: { en: 'All caught up', ms: 'Semua selesai' },
      desc: {
        en: 'Clear every review that is due',
        ms: 'Selesaikan semua ulang kaji yang perlu',
      },
      // only meaningful once there is something to be caught up ON
      earned: seen > 0 && due === 0,
    },
  ]

  // One badge per topic, so progress maps onto the syllabus the learner sees.
  for (const topic of CONTENT.topics) {
    const items = topic.lessons.flatMap((l) => l.items)
    if (!items.length) continue
    const done = items.filter(
      (i) => (reviewMap.get(i.id)?.box ?? 0) >= MAX_BOX,
    ).length
    badges.push(
      count(
        `topic-${topic.id}`,
        '⭐',
        topic.title,
        { en: 'Master every item in this topic', ms: 'Kuasai setiap item dalam topik ini' },
        done,
        items.length,
      ),
    )
  }

  return badges
}

export function earnedCount(badges: Badge[]): number {
  return badges.filter((b) => b.earned).length
}

/**
 * Badges that are newly earned relative to a previous snapshot — used to
 * celebrate at the end of a session rather than silently ticking over.
 */
export function newlyEarned(before: Badge[], after: Badge[]): Badge[] {
  const had = new Set(before.filter((b) => b.earned).map((b) => b.id))
  return after.filter((b) => b.earned && !had.has(b.id))
}
