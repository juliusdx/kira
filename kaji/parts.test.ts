import { describe, it, expect } from 'vitest'
import {
  availableFor,
  consumedKeys,
  gradePart,
  validatePart,
  type PartData,
  type PartResponse,
} from './parts'

// Fixture is worksheet WA0065's actual shape: ONE bank of 11 terms, a
// six-organ diagram and a five-blank cloze. The 5 the diagram does not use are
// exactly the cloze's answers — that is the pedagogy, not a coincidence.

const t = (zh: string, ms: string, en: string) => ({ zh, ms, en })

const WA0065: PartData = {
  bank: [
    { key: 'mouth', label: t('口腔', 'Mulut', 'Mouth') },
    { key: 'oesophagus', label: t('食道', 'Esofagus', 'Oesophagus') },
    { key: 'stomach', label: t('胃', 'Perut', 'Stomach') },
    { key: 'small-intestine', label: t('小肠', 'Usus kecil', 'Small intestine') },
    { key: 'large-intestine', label: t('大肠', 'Usus besar', 'Large intestine') },
    { key: 'anus', label: t('肛门', 'Dubur', 'Anus') },
    { key: 'digestion', label: t('消化', 'Penghadaman', 'Digestion') },
    { key: 'nutrients', label: t('养分', 'Nutrien', 'Nutrients') },
    { key: 'absorb', label: t('吸收', 'Menyerap', 'Absorb') },
    { key: 'saliva', label: t('唾液', 'Air liur', 'Saliva') },
    { key: 'faeces', label: t('粪便', 'Najis', 'Faeces') },
  ],
  children: [
    {
      id: 'diagram',
      kind: 'label_diagram',
      sp_code: '3.3.1',
      slots: [
        { id: 'd1', answer: 'mouth' },
        { id: 'd2', answer: 'oesophagus' },
        { id: 'd3', answer: 'stomach' },
        { id: 'd4', answer: 'small-intestine' },
        { id: 'd5', answer: 'large-intestine' },
        { id: 'd6', answer: 'anus' },
      ],
    },
    {
      id: 'cloze',
      kind: 'cloze',
      sp_code: '3.3.2',
      slots: [
        { id: 'c1', answer: 'digestion' },
        { id: 'c2', answer: 'saliva' },
        { id: 'c3', answer: 'nutrients' },
        { id: 'c4', answer: 'absorb' },
        { id: 'c5', answer: 'faeces' },
      ],
    },
  ],
}

const keysOf = (opts: { key: string }[]) => opts.map((o) => o.key).sort()
const ALL_DIAGRAM = ['anus', 'large-intestine', 'mouth', 'oesophagus', 'small-intestine', 'stomach']
const ALL_CLOZE = ['absorb', 'digestion', 'faeces', 'nutrients', 'saliva']

/** Every diagram slot answered correctly. */
const diagramAllRight: PartResponse = {
  d1: 'mouth',
  d2: 'oesophagus',
  d3: 'stomach',
  d4: 'small-intestine',
  d5: 'large-intestine',
  d6: 'anus',
}

describe('the shared bank', () => {
  it('is exactly the union of both children’s answers, and they are disjoint', () => {
    // The property the whole design rests on: 6 + 5 = 11, no overlap, no
    // surplus. If the bank were larger the extras would be noise; if the two
    // answer sets overlapped, depletion would make one child unanswerable.
    const diagram = WA0065.children[0].slots.map((s) => s.answer).sort()
    const cloze = WA0065.children[1].slots.map((s) => s.answer).sort()
    expect(diagram).toEqual(ALL_DIAGRAM)
    expect(cloze).toEqual(ALL_CLOZE)
    expect(diagram.filter((k) => cloze.includes(k))).toEqual([])
    expect([...diagram, ...cloze].sort()).toEqual(keysOf(WA0065.bank))
  })

  it('offers the whole bank to both children before anything is answered', () => {
    expect(availableFor(WA0065, {}, 'diagram')).toHaveLength(11)
    expect(availableFor(WA0065, {}, 'cloze')).toHaveLength(11)
  })

  it('THE POINT: a fully-correct diagram leaves the cloze exactly its own answers', () => {
    // This is what makes a shared bank worth having. Six correct placements
    // reduce eleven options to the five the cloze needs, so elimination across
    // the two children is a real strategy rather than a coincidence.
    expect(keysOf(availableFor(WA0065, diagramAllRight, 'cloze'))).toEqual(ALL_CLOZE)
  })

  it('depletes on a CORRECT placement', () => {
    const r: PartResponse = { d3: 'stomach' }
    expect(consumedKeys(WA0065, r)).toEqual(new Set(['stomach']))
    expect(keysOf(availableFor(WA0065, r, 'cloze'))).not.toContain('stomach')
  })

  it('does NOT deplete on a WRONG placement — one error must not cascade', () => {
    // The decision, and the reason for it. Under true depletion a single
    // mis-tap on the diagram would leave the cloze holding a term it does not
    // want and missing one it does — a second item failed through no fresh
    // fault. Harsh for a nine-year-old, and diagnostically false.
    const r: PartResponse = { d3: 'saliva' } // 'saliva' is a CLOZE answer
    expect(consumedKeys(WA0065, r)).toEqual(new Set())
    expect(keysOf(availableFor(WA0065, r, 'cloze'))).toContain('saliva')
  })

  it('so the cloze is still fully answerable after a wrong diagram placement', () => {
    const r: PartResponse = { ...diagramAllRight, d3: 'faeces' } // stomach slot wrong
    const avail = keysOf(availableFor(WA0065, r, 'cloze'))
    for (const k of ALL_CLOZE) expect(avail, `cloze needs ${k}`).toContain(k)
  })

  it('will not let one child use the same term twice, right or wrong', () => {
    // You cannot label two organs 小肠 on one diagram.
    const r: PartResponse = { d1: 'mouth' }
    expect(keysOf(availableFor(WA0065, r, 'diagram'))).not.toContain('mouth')
  })

  it('a term used wrongly in this child is still blocked within this child', () => {
    const r: PartResponse = { d1: 'saliva' }
    expect(keysOf(availableFor(WA0065, r, 'diagram'))).not.toContain('saliva')
    // ...but returns to the OTHER child, per the depletion rule.
    expect(keysOf(availableFor(WA0065, r, 'cloze'))).toContain('saliva')
  })

  it('returns nothing for an unknown child rather than throwing', () => {
    expect(availableFor(WA0065, {}, 'no-such-child')).toEqual([])
  })

  it('ignores responses for slots that do not exist', () => {
    // An item re-authored after an attempt was recorded. Kira's rule: degrade,
    // never throw on a screen someone is looking at.
    expect(consumedKeys(WA0065, { ghost: 'mouth' })).toEqual(new Set())
  })
})

describe('grading', () => {
  it('gives partial credit with a per-child, per-SP breakdown', () => {
    const g = gradePart(WA0065, diagramAllRight)
    expect(g.placed).toBe(6)
    expect(g.of).toBe(11)
    expect(g.byChild.map((c) => [c.childId, c.sp_code, c.placed, c.of])).toEqual([
      ['diagram', '3.3.1', 6, 6],
      ['cloze', '3.3.2', 0, 5],
    ])
  })

  it('weights by SLOTS, not by child — a 6-slot child is not worth half', () => {
    // The mean of the children's scores would be (1.0 + 0) / 2 = 0.5 here,
    // which would make one careless slot in the cloze cost more than one in the
    // diagram. Slots over slots: 6/11.
    expect(gradePart(WA0065, diagramAllRight).score).toBeCloseTo(6 / 11, 10)
  })

  it('scores a full-marks response 1', () => {
    const all: PartResponse = { ...diagramAllRight }
    for (const s of WA0065.children[1].slots) all[s.id] = s.answer
    const g = gradePart(WA0065, all)
    expect(g.score).toBe(1)
    expect([g.placed, g.of]).toEqual([11, 11])
  })

  it('scores an untouched part 0 without dividing by zero', () => {
    expect(gradePart(WA0065, {}).score).toBe(0)
    expect(gradePart({ bank: [], children: [] }, {}).score).toBe(0)
  })
})

describe('a sequence child inside a Part', () => {
  // Bank is still exactly the union and still disjoint: 3 steps + 2 cloze terms.
  const MIXED: PartData = {
    bank: [
      { key: 'chew', label: t('咀嚼', 'Mengunyah', 'Chew') },
      { key: 'swallow', label: t('吞咽', 'Menelan', 'Swallow') },
      { key: 'digest', label: t('消化', 'Menghadam', 'Digest') },
      { key: 'saliva', label: t('唾液', 'Air liur', 'Saliva') },
      { key: 'nutrients', label: t('养分', 'Nutrien', 'Nutrients') },
    ],
    children: [
      {
        id: 'order',
        kind: 'sequence',
        sp_code: '3.3.1',
        slots: [
          { id: 'q1', answer: 'chew' },
          { id: 'q2', answer: 'swallow' },
          { id: 'q3', answer: 'digest' },
        ],
      },
      {
        id: 'cloze',
        kind: 'cloze',
        sp_code: '3.3.2',
        slots: [
          { id: 'c1', answer: 'saliva' },
          { id: 'c2', answer: 'nutrients' },
        ],
      },
    ],
  }

  it('is graded on LINKS, so 3 steps report `of: 2` not 3', () => {
    const g = gradePart(MIXED, { q1: 'chew', q2: 'swallow', q3: 'digest' })
    const seq = g.byChild.find((c) => c.childId === 'order')!
    expect([seq.placed, seq.of]).toEqual([2, 2])
    expect(seq.score).toBe(1)
  })

  it('credits a rotated chain instead of zeroing it', () => {
    // The whole reason for the dispatch. Position scoring would give 0 here.
    const g = gradePart(MIXED, { q1: 'digest', q2: 'chew', q3: 'swallow' })
    const seq = g.byChild.find((c) => c.childId === 'order')!
    expect([seq.placed, seq.of]).toEqual([1, 2])
    expect(seq.score).toBe(0.5)
  })

  it('mixes units in the Part total, and that is the documented trade-off', () => {
    // 2 links + 2 cloze slots = 4 scoreable units, not 5 slots. A sequence child
    // is very slightly under-weighted against a same-size slot child; the
    // alternative was fudging the pair score onto a slot count.
    const g = gradePart(MIXED, { q1: 'chew', q2: 'swallow', q3: 'digest' })
    expect(g.of).toBe(4)
    expect(g.placed).toBe(2)
    expect(g.score).toBe(0.5)
  })

  it('validatePart rejects a sequence child too short to have an order', () => {
    const data: PartData = {
      bank: MIXED.bank,
      children: [
        { ...MIXED.children[0], slots: [{ id: 'q1', answer: 'chew' }] },
        MIXED.children[1],
      ],
    }
    expect(validatePart(data).join()).toMatch(/order: .*at least 2 steps/)
  })
})

describe('the authoring guard', () => {
  it('passes the real worksheet', () => {
    expect(validatePart(WA0065)).toEqual([])
  })

  it('flags a bank option no child answers — the surplus IS the finding', () => {
    // If the bank is bigger than the union of the answers, the extras are noise
    // and the elimination pedagogy quietly dies. Nothing else would catch it.
    const data: PartData = {
      ...WA0065,
      bank: [...WA0065.bank, { key: 'spleen', label: t('脾', 'Hempedu', 'Spleen') }],
    }
    expect(validatePart(data).join()).toMatch(/spleen.*noise|noise.*spleen/s)
  })

  it('flags an answer that is not in the bank', () => {
    const data: PartData = {
      ...WA0065,
      children: [
        { ...WA0065.children[0], slots: [{ id: 'd1', answer: 'pancreas' }] },
        WA0065.children[1],
      ],
    }
    expect(validatePart(data).join()).toMatch(/"pancreas" is not in the bank/)
  })

  it('flags a duplicate slot id across children', () => {
    const data: PartData = {
      ...WA0065,
      children: [
        { ...WA0065.children[0], slots: [{ id: 'x', answer: 'mouth' }] },
        { ...WA0065.children[1], slots: [{ id: 'x', answer: 'saliva' }] },
      ],
    }
    expect(validatePart(data).join()).toMatch(/slot id "x" is used twice/)
  })

  it('flags a missing sp_code, because PBD reports per standard', () => {
    const data: PartData = {
      ...WA0065,
      children: [{ ...WA0065.children[0], sp_code: '' }, WA0065.children[1]],
    }
    expect(validatePart(data).join()).toMatch(/missing sp_code/)
  })

  it('flags a bank option that is not trilingual', () => {
    const data: PartData = {
      ...WA0065,
      bank: [{ key: 'mouth', label: { zh: '口腔', ms: '', en: 'Mouth' } }, ...WA0065.bank.slice(1)],
    }
    expect(validatePart(data).join()).toMatch(/not trilingual/)
  })

  it('rejects a one-child part — that is just an item', () => {
    const data: PartData = { ...WA0065, children: [WA0065.children[0]] }
    expect(validatePart(data).join()).toMatch(/just an item/)
  })
})
