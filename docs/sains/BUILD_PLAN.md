# Primary Science tuition app, built on Kira's system

Assessment written 2026-08-07, after reading `Kira Accounting Tutor` at commit `c848c29`
(`github.com/juliusdx/kira`), the KSSR Sains DSKP for Years 1–6, and the 81 worksheets in
`My Drive/Lessons`.

---

## 1. The headline

**About 70% of Kira transfers to Science unchanged, and it is the expensive 70%.** The
whole backend — 9 migrations, RLS policies, SECURITY DEFINER roll-ups, the classroom
model, the roster, push reminders, the probe-sweep tooling, the SQL test harness — is
already subject-agnostic, and not by accident. Kira's own design rule says it out loud
in three separate places: *"SQL has never known what an item is."* `item_id` carries no
foreign key in `review_state`, `attempts`, `item_notes` or `learner_last_wrong`. `chosen`
is opaque jsonb. `class_item_stats` returns items, not skills, precisely so the roll-up
happens in TypeScript against the content bundle.

That decision, made for portability inside SPM accounting, means the Science app can point
at a fresh Supabase project, paste `bootstrap_new_project.sql`, and have a working
multi-tenant classroom backend on day one.

What does **not** transfer is the part that is genuinely about accounting: eight item
types, their eight renderers, the grader, and the 356-item bank.

And there are three things Kira has never had to do that Science forces:
**images**, **a third language**, and **grading free text**.

---

## 2. What transfers, line by line

| Area | LOC (non-test) | Verdict |
|---|---|---|
| `src/sync/*` — client, identity, reconcile, classes, roster, push, notes, insight | 1,784 | **Transfers unchanged.** Zero accounting references. |
| `supabase/migrations/0001–0009` + `tests/` + `maintenance/` | ~2,500 SQL | **Transfers unchanged.** `bootstrap_new_project.sql` is one paste. |
| `src/scheduler/scheduler.ts` — Leitner boxes 1–5, pure | 67 | **Transfers unchanged.** |
| `src/session/buildQueue.ts` | 87 | **Transfers unchanged.** |
| `src/db/*` — Dexie, local-first seam | 235 | **Transfers unchanged** (drop `examRuns.answers: string[]` assumption). |
| `src/app/*` — badges, nextAction, profile, avatar, progress | 820 | **Transfers unchanged.** Badges derive from review_state + attempts. |
| `src/lib/*` — authoringBrief, chosenAnswer, clipboard | 334 | **Mostly transfers.** `chosenAnswer` needs new per-type describers. |
| `src/components/*` chrome — Home, Progress, Classes, Leaderboard, MyNotes, SessionComplete, Badges, play.tsx, ui.tsx | ~3,950 | **Transfers,** minus copy. The two-design-language split (playful learner / sober teacher) is right for this product too. |
| `src/exam/paper.ts` — deterministic seeded paper, blueprint-as-data | 229 | **Shell transfers.** `BLUEPRINT` becomes UASA, not SPM Kertas 1. |
| PWA config, GitHub Actions → Pages, custom domain | — | **Transfers.** |
| `src/content/types.ts` — 8 accounting item types | 482 (with loader) | **Replace the type union.** Keep the Topic→Lesson→Item spine. |
| `src/components/items/*` — 8 renderers | 1,150 | **Replace.** Only `NumericItem` and `FadedStepItem` survive in spirit. |
| `src/grading/grade.ts` | 168 | **Replace** the dispatch; keep the pure-function discipline. |
| `seed_content.json` — 356 items | 577 KB | **Replace entirely.** |
| `src/i18n/strings.ts` | 501 | **Rewrite** — every string needs a third language. |

---

## 3. The three things Kira has never done

### 3.1 Images are a hard requirement, and the PWA precache will break first

Kira contains exactly **one** `<img>` tag in the entire application, and the content
schema has no concept of an asset. Science cannot work this way: **roughly 45 of the 81
worksheets contain at least one item that does not exist without its artwork** — teeth
labelling, digestive-tract labelling, plant identification (虎尾兰 vs 苔藓), animal-skull
comparison, meniscus reading, grid-paper area estimation, cube-count volume.

The trap is in `vite.config.ts`. The Workbox precache glob is
`**/*.{js,css,html,svg,png,ico,json,woff2}` — every image in the build gets precached on
first load. That is correct at Kira's scale (four icons). At 1,500 items with diagrams it
means a new learner downloads tens of megabytes before the app opens, on a Sabah mobile
connection.

**The fix has to be designed in, not retrofitted:** author diagrams as inline SVG in the
content bundle where possible (they compress, they scale, they theme, and they stay
searchable for the content guard), and for genuine photographs use a runtime-cached
route with per-topic prefetch — cache the images for the topic a learner is *about* to
practise, not all of them. This is the single biggest new build and it should be
prototyped before anything else, because it constrains the content schema.

### 3.2 Trilingual is a schema change, not a translation job

`Locale = 'en' | 'ms'` and `LocalizedText { en, ms }` are load-bearing. Adding `zh` touches
84 sites across 31 files, but the coupling is concentrated — `types.ts` (9), `loader.ts` (5),
`grade.ts` (5), `ItemPreview.tsx` (9), `FadedStepItem.tsx` (4). The mechanical work is a
day; the content work is the whole project.

**The good news is real, and it is the reverse of Kira's situation.** Kira's biggest
open risk is that 254 of 356 items carry BM that Claude authored and no Malay reader has
ever checked. Science is not like that: KPM publishes a **separate, fully-Chinese DSKP
Sains edition for SJKC at every year level**, so the Chinese terminology is *sourced*,
not invented. 地下茎, 吸芽, 孢子, 排水法 come from the official document. Build the
glossary from the DSKP first and author against it, and the app avoids repeating Kira's
single worst quality problem.

Suggested precedence: **中文 is authoritative** (it is the language of instruction and of
the official SJKC DSKP), **BM is the assessment language** (SP codes, TP bands, UASA
paper), **English is the third label**. That is the reverse of Kira, where English is the
canonical answer space.

⚠️ One structural consequence: Kira uses **English canonical values as the answer space**
(`ChoiceItem.answer` is an English string; `options_ms` is display-only). If Chinese is
authoritative, either flip the canon to a language-neutral key or accept English keys as
an internal identifier that no learner ever sees. **Use opaque keys** — `opt-a`, `spora` —
and make all three languages display labels. Kira's approach works because accounting
account names are stable English terms; 孢子 has no such privileged rendering.

### 3.3 TP5/TP6 cannot be auto-graded, and PBD alignment is the product

Every grader in Kira is deterministic and pure. That is a virtue and it is why the test
suite is trustworthy. But the KSSR performance bands go to TP6, and the top bands are
explicitly free-response: *"设计一个营养均衡的餐点并写出原因"*, *"预测人类将面临的状况"*,
*"写出计算铁钉体积的步骤"*.

Worse, the exam has moved this way. UPSR is gone. Year 4–6 pupils now sit **UASA**: 75
minutes, 50 marks, and **Section C alone is 32 of those 50 marks across only 4 extended
structured-response questions**. The KPM blueprint mandates a 5:3:2 easy:medium:hard split,
so 20% of items are deliberately hard. An app that drills only MCQ recall would
systematically under-prepare pupils for the paper they actually sit — and it would cap
out at TP3 on a school report that goes to TP6.

So there must be an **LLM grading path** for short-answer items. Design notes:

- It belongs in a Supabase **Edge Function**, not the client — the API key must never
  reach a public bundle, and Kira already has the deploy path (`send-reminders`).
- It breaks offline-first. A short-answer item answered offline must queue and grade on
  reconnect, and the UI must say so. This is a new state Kira has never had:
  *answered but not yet graded*.
- It must be **cheap and bounded**. Rubric-based, one call per attempt, short output. At
  a few hundred attempts a day this is small; it is still the first per-learner marginal
  cost in the product, and the first thing that makes a business model necessary.
- Grade **against the SP's own TP descriptor**, not against a model answer. The TP bands
  are published; that is the rubric.

---

## 4. The schema decision that matters most

Kira's spine is `Topic → Lesson → Item`, with `skill_tags: string[]` on the item. That
spine is right and should be kept. But the Science hierarchy is published and the school
reports against it:

```
Tema (6, fixed across all years)
└── Tajuk (topic, 1.0, 2.0, …)          → Kira's Topic
    └── Standard Kandungan (SK, 5.2)     → Kira's Lesson
        └── Standard Pembelajaran (SP, 5.2.1)   ← the assessable unit
            └── Tahap Penguasaan TP1–TP6
```

**Key items on `(sp_code, tp_level)`, not on chapter.** Every worksheet in the folder
carries an SP code and a TP band, and teachers record 掌握／未掌握 per standard. That is
the unit the school actually reports in — and per-standard mastery is precisely the thing
a parent would pay for visibility into. Kira's `weakestSkills()` already does the roll-up
in TypeScript; point it at SP codes and the teacher screens light up for free.

Concretely, on `BaseItem`:

```ts
sp_code: string        // '3.3.2'  — the assessable statement
tp_level: number       // 1..6     — which band this item evidences
year: number           // 1..6     — content has a shelf life; see §6
```

`skill_tags` stays for cross-cutting things the SP codes don't capture
(`kemahiran-proses-sains`, `meramal`, `mengukur`).

---

## 5. Item types for primary Science

Mapping the formats actually present in the 81 worksheets, ranked by frequency, onto a
type union:

| New type | Replaces / from | Kira analogue | Auto-gradable |
|---|---|---|---|
| `mcq` | 选择题, 圈出正确的答案 (22 files) | `ChoiceItem` — near-direct reuse | Yes |
| `true_false` | 是非题 √/X (6) | `ChoiceItem` with 2 options | Yes |
| `cloze` | 填空 with word bank (20) | new; closest to `FadedStepItem` | Yes |
| `matching` | 连线 (11), incl. 3-column | new — needs drag-line UI | Yes |
| `classify` | 分类 into groups (10) | `StatementBuildItem`'s section-sorting is the exact mechanic | Yes |
| `label_diagram` | 标示图 (10) | **new — needs image hotspots** | Yes |
| `sequence` | 排列 1–6 (6) | new; simplest of the new ones | Yes |
| `numeric` | 测量读数, 计算 (5) | `NumericItem` — direct reuse, keep `unit`/`unitAfter` | Yes |
| `short_answer` | 写出原因, 预测 (13 across TP4–6) | **new — LLM graded** | Rubric |
| `faded_step` | procedures: 排水法, 消化过程 | `FadedStepItem` — direct reuse | Yes |

Two observations worth acting on:

**`sequence` is the best first build.** The digestion-process ordering appears across
three different publishers' materials, it is trivially auto-gradable, and it exercises the
whole pipeline (content → renderer → grader → scheduler → sync) without needing images or
an LLM. Ship that end-to-end first.

**`StatementBuildItem` is secretly a classification widget.** It already sorts labelled
lines into named sections and computes a total. Strip the total and it *is*
分类. That is the highest-leverage piece of renderer reuse in the codebase.

---

## 6. Two timing facts that should shape the roadmap

**Year 1 content has a shelf life ending January 2027.** KP2027 replaces KSSR starting
with Year 1 in 2027, advancing one cohort per year, with KSSR Semakan 2017 reportedly
running until ~2031 for cohorts already inside it. Under KP2027, standalone Sains is
reported to disappear at Year 1, folded into an integrated subject provisionally called
*Alam dan Manusia*, returning standalone around Years 5–6.

> ⚠️ That KP2027 detail comes from Malaysian education news and a teacher blog, **not**
> from a KPM primary document — `bpk.moe.gov.my` was blocked during research. Verify
> against the KPM "Kerangka Kurikulum Persekolahan 2027" before betting on it.

If it holds, **building Year 1 first would be building the one module guaranteed to
expire.** Despite the Year 1–6 scope, start at **Year 3** — it is where the source
material is, it is where your daughter is, and it has years of life left. Then 4, 5, 6
(the UASA years), then 2, then 1 last or never. Version content per year level as
independent modules, not one monolith.

**UPSR may return.** The Ministry set an end-of-2026 deadline on a policy review of
whether to reinstate UPSR and PT3 (Malay Mail, 15 Jan 2026). Kira already got this right
by accident: `BLUEPRINT` is data and a test asserts it sums correctly. Keep the target
exam a swappable config — item counts, marks, duration, difficulty ratio — rather than
hard-coding UASA.

---

## 7. Fork, or make Kira multi-subject?

This is the real decision and it is not obvious.

**Fork the repo.** Fastest to a working Science app — a week of deletion and the shell
runs. But it duplicates 1,784 LOC of sync and 9 migrations, so every RLS fix, every
push-reminder fix, every lesson in Kira's gotcha log gets applied twice or diverges. And
Kira's gotcha log is the most valuable file in that repo.

**Make the item-type registry pluggable, in Kira, as a normal Kira PR.** Today
`ItemRenderer` is a hard-coded switch over eight types and `grade()` is a matching switch.
Replace both with a registry — each type registers a renderer, a grader and a content
validator — and one codebase can host both subjects with the content bundle selecting the
type set. That is maybe 300–500 LOC of refactor, it is **independently valuable to Kira**
(it is also how you would add new SPM item types), and it is testable in isolation.

Kira's own CLAUDE.md says it is *"architected to become a JC Labs product (content-as-data,
tenant-neutral schema)"*. The registry refactor is the missing half of that sentence:
content is already data, but item *types* are still code.

**Recommendation: the registry refactor, then a fork that only replaces the content
layer.** The cost is one or two careful Kira PRs against a live app; the payoff is that
the Science app inherits every future backend fix for free. The risk to manage is that
Kira ships several times a day to a real classroom, so the refactor must land behind
green tests with no behaviour change — which is exactly the kind of change Kira's 288-test
hermetic suite is good at proving.

---

## 8. Suggested sequence

**Phase 0 — decide and de-risk (days)**
Confirm the KP2027 Year-1 question against a KPM document. Prototype the image pipeline:
one `label_diagram` item, inline SVG, and measure what it does to bundle size. This
constrains everything downstream, so do it before the schema is locked.

**Phase 1 — the registry refactor in Kira (1–2 PRs)**
`ItemRenderer` switch → registry. `grade()` switch → registry. `content.test.ts`
validators → per-type. No behaviour change; 288 tests stay green.

**Phase 2 — the Science shell, one item type end to end**
New Supabase project via `bootstrap_new_project.sql`. `Locale` gains `zh`. Opaque answer
keys. `sequence` items for 消化过程, Year 3, authored from the DSKP glossary. Prove
content → renderer → grader → Leitner → sync → teacher roster.

**Phase 3 — the auto-gradable type set**
`mcq`, `true_false`, `cloze`, `classify`, `numeric`, `matching`. This covers roughly 70%
of what is in the worksheets and takes the app to a genuinely useful TP1–TP3 product.

**Phase 4 — images**
`label_diagram`, plus artwork for the items in the other types that need it. Per-topic
runtime caching. This is where the real effort is.

**Phase 5 — the LLM grader**
Edge Function, TP-descriptor rubrics, the offline "answered, not yet graded" state.
Unlocks TP4–TP6 and Section C of UASA.

**Phase 6 — content at scale**
Year 3 complete, then 4, 5, 6. For calibration: Kira reached 356 items for one SPM
subject. Six years of primary Science at comparable density is plausibly **1,500–2,500
items**. That is the project. Everything above is the machine that carries it.

---

## 9. Honest risks

**Content volume is the project.** Everything in §1–8 is maybe two months of engineering.
The content is a year of authoring, and Kira's history shows exactly how it goes wrong —
duplicate item ids that were invisible to the guard, a global replace that ate the word it
was meant to teach, three separate bad-Malay sweeps in one day. Port the content guard
*and its gotcha log* on day one, not after the first bad merge.

**Three languages triples the review burden.** Kira has one unread language debt (254
items of Claude's BM). Science would have three surfaces. The DSKP-sourced Chinese
mitigates this substantially, but BM and English labels would still be authored. Build
the `bm-review.mjs` equivalent — a generated, finite review document — *before* authoring
at volume, not after.

**`seed_content.json` will be worse here.** Kira's is 13k lines and 577 KB for one
subject and is already named as the likeliest bad merge in the repo. At 2,000 items across
six years it should be **split file-per-year or file-per-topic** from the start, with the
loader concatenating. Do not inherit the single-file shape.

**The naming.** *Kira* means "to count" in Malay — perfect for accounting, meaningless for
Science. **Kaji** is the natural sibling: *mengkaji* is to investigate or study, it is
literally the inquiry verb the syllabus is built on (Inkuiri dalam Sains), and it is the
same four-letter Malay-verb shape. Worth grabbing the domain before you are attached to
something else.
