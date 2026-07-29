import type { Item, Locale, LocalizedText } from '../content/types'
import { skillLabel, t as tc } from '../content/loader'
import type { ChosenLine } from './chosenAnswer'

/**
 * Content is DATA, and the author is a person with a text editor — so the way
 * a teacher acts on "she keeps getting this wrong" is to hand the author a
 * brief, not to open a CMS that does not exist.
 *
 * This builds that brief as plain text: which item, how it is going, what the
 * app currently tells the learner, and what the teacher thinks it should say
 * instead. Pure, so the wording is testable without a clipboard.
 */
export interface BriefInput {
  item: Item
  topicTitle: LocalizedText | null
  lessonTitle: LocalizedText | null
  wrong: number
  lastWrongAt: string
  siblings: number
  /** What the teacher wrote — the reason this brief is worth sending at all. */
  teacherNote: string
  learnerName: string | null
  locale: Locale
  /**
   * The learner's last wrong answer, already made readable. Null when it was
   * never recorded. This is the most useful line in the whole brief: it is the
   * difference between "add more items" and "the explanation never addresses
   * the mistake they are actually making".
   */
  chosen?: ChosenLine[] | null
}

function bilingual(text: LocalizedText | null | undefined): string {
  if (!text) return '—'
  return `EN: ${text.en}\n  MS: ${text.ms}`
}

export function buildAuthoringBrief(input: BriefInput): string {
  const { item, locale } = input
  const tags = (item.skill_tags ?? []).filter(Boolean)
  const lines: string[] = []

  lines.push(`Kira — authoring request`)
  lines.push(``)
  lines.push(`Item:       ${item.id} (${item.type}, difficulty ${item.difficulty})`)
  lines.push(
    `Where:      ${input.topicTitle ? tc(input.topicTitle, locale) : '—'}` +
      (input.lessonTitle ? ` › ${tc(input.lessonTitle, locale)}` : ''),
  )
  lines.push(
    `Skills:     ${
      tags.length ? tags.map((tag) => `${skillLabel(tag, locale)} (${tag})`).join(', ') : '—'
    }`,
  )
  lines.push(
    `Getting it wrong: ${input.wrong}×${
      input.learnerName ? ` — ${input.learnerName}` : ''
    }, last on ${input.lastWrongAt}`,
  )
  lines.push(
    `Other items on these skills already in the bank: ${input.siblings}`,
  )
  lines.push(``)
  lines.push(`Question`)
  lines.push(`  ${bilingual(item.prompt)}`)
  lines.push(``)

  if (input.chosen?.length) {
    lines.push(`What they actually answered (most recent wrong attempt)`)
    for (const line of input.chosen) {
      // Mark the wrong parts: on a multi-part item the misconception is in
      // which PART went wrong, and an unmarked list buries that.
      lines.push(`  ${line.ok ? ' ' : '✗'} ${line.label}: ${line.value}`)
    }
    lines.push(``)
  }

  lines.push(`Explanation the learner is shown now`)
  lines.push(`  ${bilingual(item.explanation)}`)
  lines.push(``)

  const note = input.teacherNote.trim()
  lines.push(`What the teacher wants instead`)
  // An empty note is the common case when someone just wants more practice,
  // so say so rather than emitting a blank heading the author has to guess at.
  lines.push(note ? `  ${note.split('\n').join('\n  ')}` : `  (no note — more practice on these skills, please)`)

  return lines.join('\n')
}
