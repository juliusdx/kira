#!/usr/bin/env node
// Generate BM_REVIEW.md — every Bahasa Malaysia string Claude authored, next to
// its English counterpart, for a human to check against the syllabus.
//
//   node scripts/bm-review.mjs
//
// Why a script and not a one-off dump: the bank changes. Re-running this after
// authoring regenerates the document, and the SCOPE below is the single place
// that records which content was written by Claude rather than ported from
// Julius's own material.
//
// The document has three parts, in descending order of leverage:
//
//   1. INCONSISTENCIES — found mechanically, no Malay needed. The same English
//      term rendered two different ways in BM, or one BM string doing duty for
//      two different English terms. These are bugs whoever is right.
//   2. TERMINOLOGY — every distinct short label, most-used first. Checking ~150
//      terms once beats reading 151 items, and a correction here applies
//      everywhere the term appears.
//   3. FULL TEXT — prompts and explanations per item, for the careful read.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = JSON.parse(readFileSync(join(ROOT, 'seed_content.json'), 'utf8'))

// --- what Claude wrote ------------------------------------------------------
// Stages 1–5 (t1..t11) were ported from Julius's own material and are NOT in
// scope. Stage 6 is t12..t17, Stage 7 is t18..t21, and the two balancing-off
// lessons were authored later into an otherwise-ported topic.
const CLAUDE_TOPICS = new Set([
  // 2026-07-30: authored to close gaps the SPM 2024 papers exposed.
  't22-documents',
  't12-bank-reconciliation',
  't13-control-accounts',
  't14-suspense',
  't15-incomplete-records',
  't16-club-accounts',
  't17-partnership',
  't18-limited-companies',
  't19-manufacturing',
  't20-ratio-analysis',
  't21-cash-budget',
])
const CLAUDE_LESSONS = new Set([
  'l30-balance-off',
  'l31-faded-balancing',
  // 2026-07-30: authored to close the reducing-balance and disposal gaps the
  // SPM 2024 papers exposed. Same provenance as everything else here — the BM
  // is Claude's, not ported.
  'l44-reducing-balance',
  'l45-disposal',
  'l46-faded-disposal',
  'l50-inventory-valuation',
  // t10 and t1 are otherwise ported topics; these two lessons are not.
  'l54-revaluation-method',
  'l56-entities-and-bodies',
  // 2026-08-03: multiple-choice items for the two topics a mock paper could
  // not examine. t3 and t4 are Julius's ported Stage 1-2 topics; these two
  // lessons inside them are Claude's, so only they are in scope.
  'l57-which-account',
  'l58-diagnose',
])

const inScope = (topic, lesson) =>
  CLAUDE_TOPICS.has(topic.id) || CLAUDE_LESSONS.has(lesson.id)

// --- the exam board's own Malay ---------------------------------------------
// Transcribed from the SPM 2024 papers, 3756/1 and 3756/2. This is the one
// authority available that does not require a human to read Malay: where our
// term differs from the paper's, the paper wins by definition, whatever a
// dictionary says.
//
// `ours` lists the renderings we actually use, so the check reports a real
// clash rather than a possible one. Extend this whenever another paper is read.
const SPM_TERMS = [
  { en: 'Receivables', spm: 'Akaun Belum Terima', ours: ['Penghutang'], where: 'K1 Q22, Q25, Q28; K2 Q2, Q4' },
  { en: 'Payables', spm: 'Akaun Belum Bayar', ours: ['Pemiutang'], where: 'K1 Q4, Q10, Q25; K2 Q2, Q4' },
  { en: 'Carrying amount / book value', spm: 'Nilai buku', ours: ['Amaun bawaan'], where: 'K1 Q17; K2 Q5(ii)' },
  { en: 'Accumulated depreciation', spm: 'Susut nilai terkumpul', ours: [], where: 'K1 Q16; K2 Q2, Q3' },
  { en: 'Reducing balance', spm: 'Baki berkurangan', ours: [], where: 'K1 Q16; K2 Q2(iii), Q3(iv)' },
  { en: 'Straight line', spm: 'Garis lurus', ours: [], where: 'K2 Q2(iii), Q5(iii)' },
  { en: 'Revaluation method', spm: 'Kaedah penilaian semula', ours: [], where: 'K2 Q3(v)' },
  { en: 'Disposal', spm: 'Pelupusan', ours: [], where: 'K1 Q17' },
  { en: 'Realisation account', spm: 'Akaun Realisasi', ours: [], where: 'K1 Q32' },
  { en: 'Break-even point', spm: 'Titik Pulang Modal', ours: [], where: 'K1 Q39' },
  { en: 'Prime cost', spm: 'Kos prima', ours: [], where: 'K1 Q40' },
  { en: 'Work in progress', spm: 'Kerja dalam proses', ours: [], where: 'K1 Q40; K2 Q3' },
  { en: 'Finished goods', spm: 'Barang siap', ours: [], where: 'K2 Q3' },
  { en: 'Direct material', spm: 'Bahan langsung', ours: [], where: 'K1 Q40; K2 Q3' },
  { en: 'Direct labour', spm: 'Buruh langsung', ours: [], where: 'K2 Q3' },
  { en: 'Manufacturing account', spm: 'Akaun Pengeluaran', ours: [], where: 'K1 Q38; K2 Q3(a)' },
  { en: 'Trial balance', spm: 'Imbangan Duga', ours: [], where: 'K1 Q1, Q12, Q20; K2 Q3' },
  { en: 'Statement of financial position', spm: 'Penyata Kedudukan Kewangan', ours: [], where: 'K1 Q20; K2 Q2(b), Q4(b)' },
  { en: 'Trading and profit and loss account', spm: 'Akaun Perdagangan dan Untung Rugi', ours: [], where: 'K1 Q20; K2 Q2(a), Q3(b)' },
  { en: 'Receipts and payments account', spm: 'Akaun Penerimaan dan Pembayaran', ours: [], where: 'K1 Q35' },
  { en: 'Income and expenditure account', spm: 'Akaun Pendapatan dan Perbelanjaan', ours: [], where: 'K1 Q36' },
  { en: 'Cash budget', spm: 'Penyata Belanjawan Tunai', ours: [], where: 'K1 Q27, Q28' },
  { en: 'Provision for doubtful debts', spm: 'Peruntukan hutang ragu', ours: [], where: 'K2 Q2, Q4, Q5' },
  { en: 'Bad debts', spm: 'Hutang lapuk', ours: [], where: 'K1 Q18, Q27; K2 Q2(v)' },
  { en: 'Returns inwards', spm: 'Pulangan masuk', ours: [], where: 'K1 Q13, Q14; K2 Q2' },
  { en: 'Returns outwards', spm: 'Pulangan keluar', ours: [], where: 'K1 Q13' },
  { en: 'Carriage inwards', spm: 'Angkutan masuk', ours: [], where: 'K1 Q13, Q14; K2 Q3(iii)' },
  { en: 'Drawings', spm: 'Ambilan', ours: [], where: 'K1 Q10, Q19; K2 Q2' },
  { en: 'Working capital', spm: 'Modal kerja', ours: [], where: 'K1 Q30; K2 Q2(b)' },
  { en: 'Inventory turnover', spm: 'Kadar Pusing Ganti Inventori', ours: [], where: 'K2 Q6' },
  { en: 'Return on capital', spm: 'Pulangan atas Modal', ours: [], where: 'K1 Q21; K2 Q6' },
  { en: 'Mark-up', spm: 'Tokokan', ours: [], where: 'K1 Q21' },
  { en: 'Current ratio', spm: 'Nisbah semasa', ours: [], where: 'K1 Q21' },
  { en: 'Ordinary shares', spm: 'Syer Biasa', ours: ['Saham Biasa'], where: 'K1 Q33, Q34' },
  { en: 'Preference shares', spm: 'Syer Keutamaan', ours: ['Saham Keutamaan'], where: 'K1 Q33' },
  { en: 'Partners current account', spm: 'Akaun Semasa', ours: [], where: 'K1 Q31' },
  { en: 'Interest on capital', spm: 'Faedah atas modal', ours: [], where: 'K1 Q31' },
  { en: 'Appropriation of profit', spm: 'Pengasingan Untung Rugi', ours: ['Pengagihan Untung'], where: 'K1 Q31' },
  { en: 'Source document', spm: 'Dokumen Sumber', ours: [], where: 'K1 Q6' },
  { en: 'Delivery note', spm: 'Nota Serahan', ours: [], where: 'K1 Q6' },
  { en: 'Statement of account', spm: 'Penyata Akaun', ours: [], where: 'K1 Q6' },
  { en: 'Petty cash float', spm: 'Panjar runcit', ours: [], where: 'K1 Q8' },
  { en: 'Petty cash book', spm: 'Buku Tunai Runcit', ours: [], where: 'K1 Q8' },
  { en: 'Books of first entry', spm: 'Buku Catatan Pertama', ours: [], where: 'K1 Q1' },
  { en: 'General journal', spm: 'Jurnal Am', ours: [], where: 'K1 Q7, Q17; K2 Q4(a), Q5' },
  { en: 'Loose tools', spm: 'Alat-alat kecil', ours: [], where: 'K1 Q26; K2 Q3(v)' },
  { en: 'Fixed deposit', spm: 'Simpanan tetap', ours: [], where: 'K2 Q2, Q4' },
  { en: 'Cost price / market price', spm: 'Harga kos / Harga pasaran', ours: [], where: 'K1 Q11; K2 Q2(i), Q6' },
]

// --- collection -------------------------------------------------------------
/** Short labelled strings: the terminology. { en, ms, where[], field } */
const terms = []
/** Long prose, per item. */
const docs = []

const addTerm = (en, ms, where, field) => {
  if (!en && !ms) return
  terms.push({ en: (en ?? '').trim(), ms: (ms ?? '').trim(), where, field })
}

/** A LocalizedText pair. */
const addLocalized = (obj, where, field) => {
  if (!obj) return
  addTerm(obj.en, obj.ms, where, field)
}

/** Parallel arrays (options/options_ms) — index-aligned by construction. */
const addParallel = (en = [], ms = [], where, field) => {
  en.forEach((v, i) => addTerm(v, ms?.[i], where, `${field}[${i}]`))
}

let itemCount = 0
const topicsOut = []

for (const topic of bundle.topics) {
  const lessonsOut = []
  for (const lesson of topic.lessons) {
    if (!inScope(topic, lesson)) continue

    addLocalized(topic.title, topic.id, 'topic title')
    addLocalized(lesson.title, lesson.id, 'lesson title')
    if (lesson.worked_example)
      addLocalized(lesson.worked_example.prompt, lesson.id, 'worked example')

    const itemsOut = []
    for (const item of lesson.items) {
      itemCount++
      const id = item.id
      const d = item.data ?? {}

      // terminology carried by the type-specific data
      addParallel(d.options, d.options_ms, id, 'option')
      addParallel(d.accounts, d.accounts_ms, id, 'account')
      if (d.account) addTerm(d.account, d.account_ms, id, 'T-account name')
      if (d.unit) addTerm(d.unit, d.unit_ms, id, 'unit')
      if (d.statement) addLocalized(d.statement, id, 'statement name')
      if (d.totalLabel) addLocalized(d.totalLabel, id, 'total label')
      for (const s of d.sections ?? []) addLocalized(s.label, id, 'section')
      for (const l of d.lines ?? []) addLocalized(l.label, id, 'statement line')
      for (const e of d.entries ?? []) addLocalized(e.label, id, 'T-account entry')
      for (const s of d.steps ?? []) {
        addLocalized(s.label, id, 'step label')
        if (s.kind === 'choice') addTerm(s.value, s.value_ms, id, 'step value')
        if (s.unit) addTerm(s.unit, s.unit_ms, id, 'step unit')
      }
      for (const x of d.distractors ?? []) addTerm(x.value, x.value_ms, id, 'distractor')

      // A translation cannot be judged without what the learner is choosing
      // BETWEEN, and a fading ladder's steps ARE its content — showing only
      // prompt and explanation would hide the substance of every faded_step.
      const pairs = (en = [], ms = []) =>
        en.map((v, i) => `${v} → **${ms?.[i] ?? '⚠ missing'}**`)

      itemsOut.push({
        id,
        type: item.type,
        difficulty: item.difficulty,
        skills: item.skill_tags ?? [],
        prompt: item.prompt,
        explanation: item.explanation,
        scenario: d.scenario ?? null,
        options: pairs(d.options, d.options_ms),
        accounts: pairs(d.accounts, d.accounts_ms),
        steps: (d.steps ?? []).map((s) => {
          const label = `${s.label.en} → **${s.label.ms}**`
          const value =
            s.kind === 'choice'
              ? ` · answer: ${s.value} → **${s.value_ms ?? '⚠ missing'}**`
              : s.unit
                ? ` · unit: ${s.unit} → **${s.unit_ms ?? '(none)'}**`
                : ''
          return `${s.blank ? '␣ ' : ''}${label}${value}`
        }),
        distractors: (d.distractors ?? []).map(
          (x) => `${x.value} → **${x.value_ms ?? '⚠ missing'}**`,
        ),
      })
      docs.push(id)
    }
    lessonsOut.push({ lesson, items: itemsOut })
  }
  if (lessonsOut.length) topicsOut.push({ topic, lessons: lessonsOut })
}

// --- 0. against the exam board's own Malay ---------------------------------
// Search the WHOLE in-scope bundle, not just the term list: a clashing word
// inside a prompt or an explanation is read by the learner just the same.
const scopedText = []
for (const topic of bundle.topics)
  for (const lesson of topic.lessons) {
    if (!inScope(topic, lesson)) continue
    scopedText.push(JSON.stringify({ t: topic.title, l: lesson.title, w: lesson.worked_example, i: lesson.items }))
  }
const haystack = scopedText.join('\n')

const countOf = (needle) => {
  if (!needle) return 0
  const re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
  return (haystack.match(re) ?? []).length
}

const spmRows = SPM_TERMS.map((row) => {
  const clashes = (row.ours ?? [])
    .map((alt) => ({ alt, n: countOf(alt) }))
    .filter((x) => x.n > 0)
  return { ...row, spmUses: countOf(row.spm), clashes }
})
const spmClashes = spmRows.filter((r) => r.clashes.length > 0)
const spmAbsent = spmRows.filter((r) => r.clashes.length === 0 && r.spmUses === 0)

// --- 1. mechanical inconsistencies -----------------------------------------
// No Malay required to find these, which is exactly why they go first.
const byEn = new Map()
const byMs = new Map()
for (const t of terms) {
  if (!t.en || !t.ms) continue
  if (!byEn.has(t.en)) byEn.set(t.en, new Map())
  const m = byEn.get(t.en)
  m.set(t.ms, [...(m.get(t.ms) ?? []), t.where])

  if (!byMs.has(t.ms)) byMs.set(t.ms, new Map())
  const e = byMs.get(t.ms)
  e.set(t.en, [...(e.get(t.en) ?? []), t.where])
}

const splitEn = [...byEn.entries()].filter(([, m]) => m.size > 1)

// Malay marks neither number nor articles, so ONE BM string covering both
// "Assets" and "An asset" is correct Malay — not a finding. Left in, that noise
// buries the real ones. What it does reveal is an ENGLISH inconsistency (two
// items offering the same concept under different canonical labels), so it is
// reported separately rather than dropped: silently filtering is how a
// truncation becomes invisible.
const enKey = (s) =>
  s
    .toLowerCase()
    .replace(/^(a|an|the)\s+/, '')
    // -ies before -s, or "liabilities" normalises to "liabilitie" and stops
    // matching "liability" — which reported a benign pair as a real finding.
    .replace(/ies$/, 'y')
    .replace(/s$/, '')
    .trim()

const splitMsAll = [...byMs.entries()].filter(([, m]) => m.size > 1)
const splitMs = splitMsAll.filter(
  ([, m]) => new Set([...m.keys()].map(enKey)).size > 1,
)
const splitMsBenign = splitMsAll.filter(
  ([, m]) => new Set([...m.keys()].map(enKey)).size === 1,
)

// --- 2. terminology ---------------------------------------------------------
const glossary = [...byEn.entries()]
  .map(([en, msMap]) => {
    const uses = [...msMap.values()].flat()
    return {
      en,
      ms: [...msMap.keys()],
      count: uses.length,
      where: [...new Set(uses)],
    }
  })
  .sort((a, b) => b.count - a.count || a.en.localeCompare(b.en))

// --- render -----------------------------------------------------------------
const L = []
const p = (s = '') => L.push(s)

p('# Kira — Bahasa Malaysia review')
p()
p('**Every BM string in the app that Claude wrote, not Julius.**')
p()
p(
  `Generated by \`node scripts/bm-review.mjs\` from \`seed_content.json\`. ` +
    `Scope: **${itemCount} items** across ${topicsOut.length} topics — Stage 6, ` +
    `Stage 7, and the two balancing-off lessons. Stages 1–5 were ported from ` +
    `Julius's own material and are deliberately excluded.`,
)
p()
p('## How to use this')
p()
p('Work top to bottom — the sections are ordered by how much a correction buys you.')
p()
p(
  '1. **Inconsistencies** are already bugs: the same English term is rendered ' +
    'two ways in BM, or one BM string covers two different English terms. ' +
    'Pick the right one and the other is a fix, whichever way it goes.',
)
p(
  '2. **Terminology** is the highest-leverage read. A term used 14 times is ' +
    'checked once here and fixed in 14 places.',
)
p('3. **Full text** is the careful pass over prompts and explanations.')
p()
p(
  'Write corrections on the `→` line under anything wrong. Leave the rest ' +
    'untouched. Hand the file back and the edits get applied to ' +
    '`seed_content.json`, which is the only real source — this document is ' +
    'generated and is never itself the content.',
)
p()
p('---')
p()

// 0
p('## 0. Against the SPM 2024 papers')
p()
p(
  'Transcribed from 3756/1 and 3756/2. This is the one section that needs no ' +
    'Malay to act on: where our word differs from the exam board\'s, the ' +
    'board wins.',
)
p()
if (spmClashes.length === 0) {
  p('**No clashes.** Every term checked matches the paper.')
} else {
  p(`### ${spmClashes.length} clash${spmClashes.length === 1 ? '' : 'es'} — we use a different word from the paper`)
  p()
  for (const r of spmClashes) {
    const mine = r.clashes.map((c) => `\`${c.alt}\` (${c.n}×)`).join(', ')
    p(`- **${r.en}** — paper says \`${r.spm}\`, we say ${mine}`)
    p(`  - paper: ${r.where}${r.spmUses ? ` · we also use the paper's term ${r.spmUses}×` : ''}`)
    p('  - → ')
  }
  p()
}
if (spmAbsent.length) {
  p('### Not found in our content either way')
  p()
  p(
    'Neither the paper\'s term nor a known alternative appears. Usually just a ' +
      'concept we word differently in prose — worth a glance, not an alarm.',
  )
  p()
  for (const r of spmAbsent) p(`- ${r.en} — paper says \`${r.spm}\` (${r.where})`)
  p()
}
p('---')
p()

// 1
p('## 1. Inconsistencies found mechanically')
p()
if (splitEn.length === 0 && splitMs.length === 0 && splitMsBenign.length === 0) {
  p('None. Every English term maps to exactly one BM string and vice versa.')
} else {
  if (splitEn.length) {
    p(`### One English term, ${splitEn.length > 1 ? 'several' : 'two'} BM renderings`)
    p()
    p('At most one of each group is right.')
    p()
    for (const [en, msMap] of splitEn) {
      p(`- **${en}**`)
      for (const [ms, where] of msMap) {
        p(`  - \`${ms}\` — ${where.length}× (${where.slice(0, 6).join(', ')}${where.length > 6 ? ', …' : ''})`)
      }
      p('  - → ')
      p()
    }
  }
  if (splitMs.length) {
    p('### One BM string used for different English terms')
    p()
    p(
      'Sometimes correct — a single Malay word can cover two English ones — but ' +
        'in an exam subject the distinction is usually the point.',
    )
    p()
    for (const [ms, enMap] of splitMs) {
      p(`- \`${ms}\` is used for:`)
      for (const [en, where] of enMap) {
        p(`  - **${en}** — ${where.length}× (${where.slice(0, 6).join(', ')}${where.length > 6 ? ', …' : ''})`)
      }
      p('  - → ')
      p()
    }
  }
  if (splitMsBenign.length) {
    p('### Not a BM problem — but the ENGLISH disagrees with itself')
    p()
    p(
      'Malay marks neither plural nor articles, so one BM string covering both ' +
        'of these is correct. What it exposes is the English side: the same ' +
        'concept is offered under two different canonical labels, in an app ' +
        'that can also be read in English.',
    )
    p()
    for (const [ms, enMap] of splitMsBenign) {
      p(`- \`${ms}\` ← ${[...enMap.keys()].map((e) => `**${e}**`).join(' / ')} (${[...enMap.values()].flat().join(', ')})`)
    }
    p('- → ')
    p()
  }
}
p()
p('---')
p()

// 2
p(`## 2. Terminology — ${glossary.length} distinct terms, most-used first`)
p()
p(
  'Every short label the learner sees: account names, options, step values, ' +
    'section headings, units. Prose is in section 3.',
)
p()
for (const g of glossary) {
  const ms = g.ms.map((m) => `\`${m}\``).join(' / ')
  p(`- ${ms} ← **${g.en}** · ${g.count}×`)
  p(`  - ${g.where.slice(0, 8).join(', ')}${g.where.length > 8 ? `, +${g.where.length - 8} more` : ''}`)
  p('  - → ')
}
p()
p('---')
p()

// 3
p('## 3. Full text, by topic')
p()
for (const { topic, lessons } of topicsOut) {
  p(`### ${topic.title.en}`)
  p()
  p(`\`${topic.id}\` · BM title: \`${topic.title.ms}\``)
  p('- → ')
  p()
  for (const { lesson, items } of lessons) {
    p(`#### ${lesson.title.en}`)
    p()
    p(`\`${lesson.id}\` · BM title: \`${lesson.title.ms}\``)
    if (lesson.worked_example) {
      p()
      p(`> **Worked example (EN)** ${lesson.worked_example.prompt.en}`)
      p(`> **(BM)** ${lesson.worked_example.prompt.ms}`)
    }
    p('- → ')
    p()
    for (const it of items) {
      p(`**\`${it.id}\`** · ${it.type} · difficulty ${it.difficulty}${it.skills.length ? ` · ${it.skills.join(', ')}` : ''}`)
      p()
      if (it.scenario) {
        p(`- *Scenario (EN)* ${it.scenario.en}`)
        p(`- *Scenario (BM)* **${it.scenario.ms}**`)
      }
      p(`- *Question (EN)* ${it.prompt.en}`)
      p(`- *Question (BM)* **${it.prompt.ms}**`)
      if (it.options.length) p(`- *Choices* ${it.options.join(' · ')}`)
      if (it.accounts.length) p(`- *Accounts offered* ${it.accounts.join(' · ')}`)
      if (it.steps.length) {
        p('- *Worked steps* (␣ marks a step the learner must supply)')
        for (const s of it.steps) p(`  - ${s}`)
      }
      if (it.distractors.length) p(`- *Wrong options offered* ${it.distractors.join(' · ')}`)
      p(`- *Why (EN)* ${it.explanation.en}`)
      p(`- *Why (BM)* **${it.explanation.ms}**`)
      p('- → ')
      p()
    }
  }
}

writeFileSync(join(ROOT, 'BM_REVIEW.md'), L.join('\n'))

// A summary for whoever ran it, not for the document.
console.log(`items in scope     ${itemCount}`)
console.log(`distinct terms     ${glossary.length}`)
console.log(`term instances     ${terms.length}`)
console.log(`EN with >1 BM      ${splitEn.length}`)
console.log(`BM covering >1 EN  ${splitMs.length} real, ${splitMsBenign.length} English-side only`)
console.log(`wrote BM_REVIEW.md`)
