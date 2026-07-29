import { describe, it, expect } from 'vitest'
import { buildAuthoringBrief } from './authoringBrief'
import { getItem } from '../content/loader'
import type { Item } from '../content/types'

const item = getItem('ta-008') as Item // Trade Receivables closing on the credit side

const base = {
  item,
  topicTitle: { en: 'Ledger & T-Accounts', ms: 'Lejar & Akaun T' },
  lessonTitle: { en: 'Balancing Off', ms: 'Mengimbangkan Akaun' },
  wrong: 3,
  lastWrongAt: '2026-07-28T09:00:00.000Z',
  siblings: 12,
  teacherNote: '',
  learnerName: 'Ariel',
  locale: 'en' as const,
}

describe('buildAuthoringBrief', () => {
  it('identifies the item precisely enough to edit seed_content.json', () => {
    const brief = buildAuthoringBrief(base)
    expect(brief).toContain('ta-008')
    expect(brief).toContain('t_account')
    expect(brief).toContain('Balancing Off')
    // the skill slug matters more than its pretty name — it is what an author
    // greps for and what any new item has to be tagged with
    for (const tag of item.skill_tags) expect(brief).toContain(tag)
  })

  it('carries the evidence: how often, who, and when', () => {
    const brief = buildAuthoringBrief(base)
    expect(brief).toContain('3×')
    expect(brief).toContain('Ariel')
    expect(brief).toContain('2026-07-28T09:00:00.000Z')
    expect(brief).toContain('12')
  })

  // The author edits a bilingual bank, so a brief that quotes only the English
  // leaves them guessing at half of what they have to change.
  it('quotes the prompt and the current explanation in BOTH languages', () => {
    const brief = buildAuthoringBrief(base)
    expect(brief).toContain(item.prompt.en)
    expect(brief).toContain(item.prompt.ms)
    expect(brief).toContain(item.explanation.en)
    expect(brief).toContain(item.explanation.ms)
  })

  it("includes the teacher's replacement wording when they wrote one", () => {
    const brief = buildAuthoringBrief({
      ...base,
      teacherNote: 'Say that the c/d goes on the SMALLER side.\nShe reads it as "the side the money is on".',
    })
    expect(brief).toContain('SMALLER side')
    expect(brief).toContain('the side the money is on')
  })

  // Wanting more practice is a perfectly good reason to send a brief, and it
  // should not arrive as a heading with nothing under it.
  it('says what it wants when the teacher wrote nothing', () => {
    const brief = buildAuthoringBrief({ ...base, teacherNote: '   ' })
    expect(brief).toContain('more practice')
  })

  it('does not fall over on an anonymous learner or a missing lesson', () => {
    const brief = buildAuthoringBrief({
      ...base,
      learnerName: null,
      lessonTitle: null,
      topicTitle: null,
    })
    expect(brief).toContain('ta-008')
    expect(brief).not.toContain('null')
    expect(brief).not.toContain('undefined')
  })
})
