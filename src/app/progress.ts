import { CONTENT, ALL_ENTRIES } from '../content/loader'
import type { Topic } from '../content/types'
import { isDue, masteryWeight, type ReviewState } from '../scheduler/scheduler'

export interface TopicProgress {
  topic: Topic
  total: number
  seen: number
  mastered: number // box 5
  masteryPct: number // 0..100, mean mastery weight
}

export interface ProgressSummary {
  dueCount: number
  newCount: number // unseen items still available to learn
  seenCount: number
  totalItems: number
  masteredCount: number
  overallPct: number
  topics: TopicProgress[]
}

export function computeProgress(
  reviewMap: Map<string, ReviewState>,
  now: number,
): ProgressSummary {
  let dueCount = 0
  let seenCount = 0
  let masteredCount = 0
  let weightSum = 0

  for (const entry of ALL_ENTRIES) {
    const state = reviewMap.get(entry.item.id)
    if (state) {
      seenCount++
      if (isDue(state, now)) dueCount++
      if (state.box >= 5) masteredCount++
    }
    weightSum += masteryWeight(state)
  }

  const topics: TopicProgress[] = CONTENT.topics.map((topic) => {
    const items = topic.lessons.flatMap((l) => l.items)
    let tSeen = 0
    let tMastered = 0
    let tWeight = 0
    for (const item of items) {
      const state = reviewMap.get(item.id)
      if (state) {
        tSeen++
        if (state.box >= 5) tMastered++
      }
      tWeight += masteryWeight(state)
    }
    return {
      topic,
      total: items.length,
      seen: tSeen,
      mastered: tMastered,
      masteryPct: items.length ? Math.round((tWeight / items.length) * 100) : 0,
    }
  })

  const totalItems = ALL_ENTRIES.length
  return {
    dueCount,
    newCount: totalItems - seenCount,
    seenCount,
    totalItems,
    masteredCount,
    overallPct: totalItems ? Math.round((weightSum / totalItems) * 100) : 0,
    topics,
  }
}
