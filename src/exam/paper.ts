import { ALL_ENTRIES, topicOf } from '../content/loader'
import type { ChoiceItem, ItemIndexEntry } from '../content/types'

// Building a mock Kertas 1.
//
// SPM Prinsip Perakaunan 3756/1 is 40 single-answer multiple choice in 1 hour
// 15 minutes. Everything here is pure so the shape of a paper can be argued
// with in a test rather than discovered on the morning of a mock.
//
// MCQ ONLY, deliberately. `classify` and `debit_credit` are the two types that
// are single-answer multiple choice; a T-account or a statement build is good
// practice and is not what this paper is. It also keeps the time budget
// honest — 75 minutes over 40 questions is under two minutes each, which no
// statement build has ever taken.

export const EXAM_QUESTIONS = 40
export const EXAM_MINUTES = 75
export const EXAM_MS = EXAM_MINUTES * 60_000

/**
 * How many questions each topic gets, modelled on the real 2024 paper rather
 * than on how many items Kira happens to hold. It is data, so it can be
 * argued with — and it sums to EXAM_QUESTIONS, which a test enforces.
 *
 * `t3-journal` and `t4-errors` used to be absent, because they held only
 * journal_entry and spot_error items and a paper cannot ask those. They were
 * missing for a CONTENT reason, never because the syllabus leaves them out —
 * double entry is the spine of the whole paper. Both now hold MCQ items and
 * both are examined here.
 *
 * The three questions that funded them came from within the same block: one
 * each off the three largest recording-cycle topics (t1, t22, t6). That keeps
 * the opening cycle at its modelled 12 questions and leaves every later topic
 * exactly where the 2024 paper put it, rather than paying for journals with a
 * mark taken from partnerships.
 */
export const BLUEPRINT: { topicId: string; count: number }[] = [
  { topicId: 't1-equation', count: 2 },
  { topicId: 't2-debit-credit', count: 1 },
  { topicId: 't22-documents', count: 3 },
  { topicId: 't3-journal', count: 2 },
  { topicId: 't4-errors', count: 1 },
  { topicId: 't5-ledger', count: 1 },
  { topicId: 't6-trial-balance', count: 2 },
  { topicId: 't7-income-statement', count: 3 },
  { topicId: 't8-financial-position', count: 2 },
  { topicId: 't9-accruals', count: 1 },
  { topicId: 't10-depreciation', count: 3 },
  { topicId: 't11-bad-debts', count: 1 },
  { topicId: 't12-bank-reconciliation', count: 2 },
  { topicId: 't13-control-accounts', count: 2 },
  { topicId: 't14-suspense', count: 2 },
  { topicId: 't15-incomplete-records', count: 1 },
  { topicId: 't16-club-accounts', count: 2 },
  { topicId: 't17-partnership', count: 3 },
  { topicId: 't18-limited-companies', count: 2 },
  { topicId: 't19-manufacturing', count: 2 },
  { topicId: 't20-ratio-analysis', count: 1 },
  { topicId: 't21-cash-budget', count: 1 },
]

export interface PaperQuestion {
  itemId: string
  topicId: string
}

/** Is this item single-answer multiple choice? */
export function isMcq(entry: ItemIndexEntry): boolean {
  return entry.item.type === 'classify' || entry.item.type === 'debit_credit'
}

export function mcqOptions(item: ChoiceItem): string[] {
  return item.data.options
}

/**
 * Deterministic PRNG. A paper is rebuilt from its seed when the learner
 * reviews it, so the same seed MUST give the same 40 questions — which rules
 * out Math.random anywhere in here.
 */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled<T>(items: T[], next: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Build one paper.
 *
 * Questions come out in syllabus order, because the real paper does too — it
 * opens on the accounting cycle and closes on manufacturing, and a learner
 * who has practised in that order should not meet it shuffled.
 *
 * If a topic cannot supply its full allocation the shortfall is redistributed
 * to topics that have spare items, so a paper is always EXAM_QUESTIONS long or
 * the bank genuinely does not hold that many multiple-choice items.
 */
export function buildPaper(
  seed: number,
  entries: ItemIndexEntry[] = ALL_ENTRIES,
): PaperQuestion[] {
  const next = rng(seed)
  const pool = new Map<string, ItemIndexEntry[]>()
  for (const e of entries) {
    if (!isMcq(e)) continue
    const list = pool.get(e.topicId)
    if (list) list.push(e)
    else pool.set(e.topicId, [e])
  }

  // Shuffle within each topic once, so "take the first N" is a random draw and
  // taking more later (redistribution) never repeats one.
  const shuffledPool = new Map<string, ItemIndexEntry[]>()
  for (const [topicId, list] of pool) shuffledPool.set(topicId, shuffled(list, next))

  const taken = new Map<string, number>()
  const picked: PaperQuestion[] = []

  const take = (topicId: string, want: number): number => {
    const list = shuffledPool.get(topicId) ?? []
    const from = taken.get(topicId) ?? 0
    const got = Math.min(want, list.length - from)
    for (let i = 0; i < got; i++)
      picked.push({ itemId: list[from + i].item.id, topicId })
    taken.set(topicId, from + got)
    return got
  }

  let shortfall = 0
  for (const { topicId, count } of BLUEPRINT) shortfall += count - take(topicId, count)

  // Spread the shortfall over whoever still has items, one at a time, so no
  // single topic swallows it.
  while (shortfall > 0) {
    let placed = 0
    for (const { topicId } of BLUEPRINT) {
      if (shortfall === 0) break
      const got = take(topicId, 1)
      shortfall -= got
      placed += got
    }
    if (placed === 0) break // the bank simply has no more MCQ items
  }

  // Back into syllabus order: the blueprint is already in topic order, but
  // redistribution appends out of order.
  const rank = new Map(BLUEPRINT.map((b, i) => [b.topicId, i]))
  return picked.sort(
    (a, b) => (rank.get(a.topicId) ?? 99) - (rank.get(b.topicId) ?? 99),
  )
}

export interface TopicScore {
  topicId: string
  correct: number
  total: number
}

export interface ExamScore {
  correct: number
  total: number
  /** whole percent, so it can be read out loud */
  pct: number
  /** worst first — what to revise, which is the only reason to show a breakdown */
  byTopic: TopicScore[]
  /** questions left blank; counted as wrong but worth saying separately */
  unanswered: number
}

/**
 * Mark the paper.
 *
 * An unanswered question is wrong — that is how the real paper marks it — but
 * it is reported separately, because running out of time and not knowing the
 * answer call for completely different advice.
 */
export function scorePaper(
  paper: PaperQuestion[],
  answers: (string | null)[],
  isCorrect: (itemId: string, answer: string | null) => boolean,
): ExamScore {
  const byTopic = new Map<string, TopicScore>()
  let correct = 0
  let unanswered = 0

  paper.forEach((q, i) => {
    const a = answers[i] ?? null
    if (a === null) unanswered++
    const ok = a !== null && isCorrect(q.itemId, a)
    if (ok) correct++
    const row = byTopic.get(q.topicId) ?? { topicId: q.topicId, correct: 0, total: 0 }
    row.total++
    if (ok) row.correct++
    byTopic.set(q.topicId, row)
  })

  const total = paper.length
  return {
    correct,
    total,
    pct: total ? Math.round((correct / total) * 100) : 0,
    unanswered,
    byTopic: [...byTopic.values()].sort(
      (a, b) =>
        a.correct / a.total - b.correct / b.total ||
        b.total - a.total ||
        a.topicId.localeCompare(b.topicId),
    ),
  }
}

/** Topic title for the breakdown, falling back to the id if content moved. */
export function topicTitleOf(itemId: string) {
  return topicOf(itemId)?.title ?? null
}
