import { describe, it, expect } from 'vitest'
import { buildAuthoringBrief, buildBriefBundle } from './authoringBrief'
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

  // The single most useful line in the brief: it tells the author whether the
  // fix is more items or a rewritten explanation.
  it('includes what the learner actually answered, marking the wrong parts', () => {
    const brief = buildAuthoringBrief({
      ...base,
      chosen: [
        { label: 'Sold goods on credit', value: 'debit', ok: true },
        { label: 'Cash received from customer', value: 'debit', ok: false },
        { label: 'Closing balance', value: 'RM 1,500', ok: false },
      ],
    })
    expect(brief).toContain('What they actually answered')
    expect(brief).toContain('Cash received from customer: debit')
    expect(brief).toMatch(/✗ Cash received from customer/)
    // a part they got right is listed but not marked as the mistake
    expect(brief).not.toMatch(/✗ Sold goods on credit/)
  })

  it('omits the answer section entirely when nothing was recorded', () => {
    for (const chosen of [undefined, null, []]) {
      const brief = buildAuthoringBrief({ ...base, chosen })
      expect(brief).not.toContain('What they actually answered')
    }
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

describe('buildBriefBundle', () => {
  const second = {
    ...base,
    item: getItem('dc-006') as Item,
    wrong: 5,
    teacherNote: 'Say which side the money is on FIRST.',
  }

  it('hands over every miss in one trip, with a header saying what the list is', () => {
    // One brief per clipboard trip is fine for the miss you happen to be
    // reading and useless for the job: sitting down once and handing over
    // everything that went wrong.
    const bundle = buildBriefBundle([base, second], 'Ariel')
    expect(bundle).toContain('2 authoring requests')
    expect(bundle).toContain("Ariel's recent misses")
    expect(bundle).toContain('ta-008')
    expect(bundle).toContain('dc-006')
    expect(bundle).toContain('Say which side the money is on FIRST.')
  })

  it('separates briefs with a rule, not a blank line', () => {
    // Blank lines get collapsed by the chat window this is pasted into, and a
    // bundle whose boundaries vanish is one unreadable brief.
    const bundle = buildBriefBundle([base, second], 'Ariel')
    expect(bundle).toMatch(/—{10,}/)
    // header + 2 briefs = 3 parts, so 2 rules between them
    expect(bundle.split(/—{10,}/)).toHaveLength(3)
  })

  it('counts one request in the singular', () => {
    expect(buildBriefBundle([base], 'Ariel')).toContain('1 authoring request from')
  })

  it('is empty for no misses, so the caller can hide the control', () => {
    expect(buildBriefBundle([], 'Ariel')).toBe('')
  })

  it('works for an unnamed learner', () => {
    // displayName is null until someone sets one, which is the default.
    const bundle = buildBriefBundle([base], null)
    expect(bundle).toContain('1 authoring request')
    expect(bundle).not.toContain('null')
  })
})
