# Kaji — decision record

Context for a coding agent working on the KSSR primary Science app that shares Kira's
architecture. Everything marked **MEASURED** came from a real production build or test
run; everything marked **ASSUMED** has not been verified and should be treated as a
hypothesis. Do not re-litigate the MEASURED items without new measurements.

Working name **Kaji** (*mengkaji*, to investigate — the inquiry verb the syllabus is built
on). *Kira* means "to count", which is right for accounting and meaningless for science.

---

## 1. What this is

A trilingual (中文 / BM / English) practice app for **Malaysian KSSR Sains, primary**,
aimed at SJKC students. Built on Kira's system: same Leitner scheduler, same local-first
Dexie store, same Supabase backend, same classroom/roster model.

**Start at Year 3, not Year 1.** Year 3 is where the source material is and it has years of
syllabus life left. Then 4–6 (the UASA years), then 2, then 1 last or never — see §6.

### 1.1 Settled by Julius, 2026-08-08

Folded in from `docs/sains/BUILD_PLAN.md`, which is now background only. These are product
decisions rather than measurements, so they are recorded with their reasoning and the date.

**Naming: keep the Malay verbs.** `Kira` (to count) for accounting, `Kaji` (to
investigate) for Science. A generic parent brand — one domain, subject tiles, e.g. "Accme
Learn" — was considered and set aside in favour of keeping the two distinct names. This
does not settle whether a parent brand later sits *above* them, or whether that is one
deploy or several.

**Origin: Kaji is served from `kaji.accme.my`.** This was the decision worth making early,
because anonymous auth is per device AND per **origin** — the first entry in Kira's gotcha
log — so changing it after launch turns every anonymous learner into a new user holding
nothing. A name is a string in the manifest; an origin is everyone's data.

- **Nothing needs buying.** `accme.my` is already owned, so the subdomain is one free DNS
  record at SiteGround (`ns1/ns2.siteground.net`) and cannot be claimed by anyone else.
- **MEASURED 2026-08-08:** no wildcard exists on `accme.my` (a nonsense host resolves to
  nothing), so `kaji.accme.my` serves nothing today rather than quietly landing on the
  WordPress site at the root. `kaji.my` is **registered** (active, via Shinjiru), as are
  `kajiapp.com` and `getkaji.com`. `kaji.com.my` showed no DNS, but `.com.my` requires
  Malaysian business registration. So the subdomain is the best option actually available,
  not a budget compromise.
- **The DNS record is deliberately NOT created yet** — its value depends on the host, which
  is still open. For Kira's Pages pattern it would be `CNAME kaji → juliusdx.github.io`
  plus a `public/CNAME` in the repo to survive deploys.

**Year order: 3 → 4, 5, 6 → 2 → 1.** Year 3 first, Years 1 and 2 last.

- **The decision does not rest on the ASSUMED KP2027 claim (§6), which is what makes it
  safe to make now.** Two of the three reasons stand alone: all 77 Science worksheets in
  the source folder are Tahun 3, and that is the year Julius's daughter is in. KP2027 only
  decides whether Year 1 ends up *last* or *never*, and either answer is years away.
- **Consequence — the image spike is the only real Phase 0.** BUILD_PLAN §8 paired
  "confirm KP2027 against a KPM document" with "prototype the image pipeline". With Year 1
  deferred to the end, the first gates nothing until Years 1–2 are in view. The second
  constrains the content schema and is now the only thing between here and authoring —
  and §3 has already answered its design question, so what remains is the prototype.

---

## 2. Architecture: share Kira, don't fork it

**~70% of Kira transfers unchanged, and it is the expensive 70%.** The backend is already
subject-agnostic by design — `item_id` carries no foreign key in `review_state`,
`attempts`, `item_notes` or `learner_last_wrong`; `chosen` is opaque jsonb;
`class_item_stats` returns items rather than skills so the roll-up happens in TypeScript.
Kira's own rule: *"SQL has never known what an item is."*

Transfers untouched: `src/sync/*` (1,784 LOC), all 9 migrations + RLS + the SQL test
harness, `scheduler.ts`, `buildQueue.ts`, `db/*`, badges/nextAction/profile/avatar, the
teacher screens, the PWA and deploy setup.

Must be replaced: the item types, their renderers, the grader, and `seed_content.json`.

**Phase 1 is done** — `kira-item-registry.patch`, verified at **300 passed / 36 files**,
typecheck clean, `vite build` succeeds. It replaces the five hard-coded switches on
`item.type` (`grade()`, `ItemRenderer`, `itemTypeLabel`, `loader.ts validate()`, and
`exam/paper.ts`'s MCQ filter) with a registry split in two:

- `src/items/logic.ts` — label, grade, validate, singleChoice. **No React.**
- `src/items/renderers.tsx` — the components.

**Do not merge those two maps.** `grade()` is imported by `buildQueue`, the scheduler and
the sync layer; a single registry would drag a component tree in behind all of them and
break the "pure grading, fully unit-testable" property the whole suite rests on.

Adding an item type is now: one union member in `types.ts`, one entry in each map. If it
needs more than that, the refactor didn't go far enough.

---

## 3. IMAGES — read this section before writing any asset code

### 3.1 We do NOT use generative image models. Trace the source artwork instead.

This was tested the long way. Hand-authoring a Year 3 anatomical figure in SVG took **five
revisions** to reach textbook legibility and the result was still visibly worse than the
worksheet it copied — a stomach that rendered as a spiral, arms that read as a coat, a
torso that read as a robe until legs were added.

Generative image models are the wrong tool here for four concrete reasons, none of which
are about quality in the abstract:

1. **They cannot produce addressable geometry.** The whole reuse argument (§3.4) depends on
   each organ being a `<path id>` you can highlight, recolour and attach a hotspot to. A
   generated raster is opaque.
2. **Anatomical and apparatus accuracy is the assessed content.** A plausible-looking
   digestive tract with the colon on the wrong side is a wrong answer key, not a style
   issue, and it fails silently.
3. **Diagrams carry text** — scale markings on a graduated cylinder, tiers of a food
   pyramid, axis labels. Generated text is unreliable and would need replacing anyway.
4. **250 assets must look like one set.** Style drift across a generated library is a real
   and expensive problem.

**Use `scripts/extract-diagram.py`** (shipped alongside this doc). One deterministic pass
over a photo of the worksheet:

```
crop → inpaint the teacher's red pen → divide out the paper's lighting gradient
     → Otsu → strip printed leader lines → despeckle → potrace to vector
```

```bash
python3 scripts/extract-diagram.py photo.jpg --box 415 250 630 625 --out digestive-system
# → src/content/diagrams/digestive-system.svg.txt  13500 B raw, 5687 B gzip
# → "figure is 628x1091 source px — place hotspots in that space"
```

Two implementation details that are load-bearing and were arrived at by failing first:

- **De-shade before thresholding.** A phone photo of a curled page has a lighting ramp.
  Adaptive thresholding copes but leaves speckle; estimating the background by
  morphological closing and dividing it out gives a flat field that plain Otsu splits
  perfectly. **MEASURED:** 10.3% ink coverage, zero speckle.
- **Strip leader lines with a morphological opening, not run-length clearing.** Clearing
  any horizontal run over 46px ate the small intestine, which genuinely contains horizontal
  runs of 40–90px. An opening with a **121×1** kernel only survives where a stroke stays
  straight for the full kernel width — true of every leader line, false of every part of
  the anatomy. That distinction is the entire trick.

potrace settings: `--opttolerance 2.0 --turdsize 80 --alphamax 1.2`, then round coordinates
to 1dp. **MEASURED:** ~17% smaller than defaults with no visible difference at 360px, checked
side by side.

### 3.2 Format: inline SVG. Never raster.

**MEASURED**, same picture, same page:

| Asset | Raw | Gzipped |
|---|---:|---:|
| Hand-drawn SVG (5 revisions, worse quality) | 1,042 B | **472 B** |
| **Traced SVG from the source photo** | 13,500 B | **5,687 B** |
| Cleaned 1-bit PNG @1x (300px) | 4,216 B | — |
| Cleaned 1-bit PNG @2x (600px) | 9,911 B | — |
| Cleaned 1-bit PNG @3x (900px) | 17,627 B | — |
| Original colour PNG @2x (retina) | — | 17,518 B |
| WebP @2x q82 | — | 3,990 B |

Fidelity costs about 12× a crude hand drawing — the trace faithfully records every wobble
of a hand-drawn original, and that is most of the byte count. It still beats every raster
option at every resolution, and it stays themeable and resolution-independent.

### 3.3 Bundling: a dedicated chunk, split per topic

**MEASURED** on a real Vite 8 / vite-plugin-pwa build matching Kira's config.

Baseline app, no diagrams: 200.5 kB JS (64.4 kB gzip), 5 precache entries.

With 400 synthetic diagrams of comparable complexity (randomised paths, so gzip can't cheat
by collapsing near-identical assets):

| Strategy | JS gzip | SVG files gzip | Precache entries | Precache total |
|---|---:|---:|---:|---:|
| inline in main bundle | 183.6 kB | — | 5 | 664 KiB |
| separate `.svg` files | 87.0 kB | 94.1 kB | **405** | 686 KiB |
| **dedicated Rollup chunk** | — | — | **6** | 664 KiB |

Payload barely differs, so payload is not the deciding factor. **Cache churn is.** All-inline
means every deploy invalidates the whole chunk and every learner re-downloads all 400
diagrams because you fixed a button. Separate files fix that but produce a 405-entry
precache manifest.

```ts
build: { rollupOptions: { output: { manualChunks(id) {
  if (id.includes('content/diagrams')) return 'diagrams'
} } } }
```

**MEASURED** churn behaviour — edited `App.tsx`, rebuilt:

```
before:  index-DIgVmQJG.js 63.77 kB   diagrams-DCnD4hog.js 123.90 kB
after:   index-pyf4aRjd.js 63.77 kB   diagrams-DCnD4hog.js 123.90 kB
         ^ new hash                    ^ UNCHANGED — stays cached
```

A code-only deploy re-downloads 63 kB instead of 184 kB. Same trick Kira already uses for
the Supabase chunk, on a different seam.

**At traced-asset sizes this needs one adjustment.** 250 traced diagrams ≈ **1.4 MB
gzipped**, not the 0.12 MB a hand-drawn library would cost. That is defensible on wifi and
unpleasant on Sabah mobile data. **Split the diagrams chunk per topic and runtime-cache on
topic entry** rather than precaching one library-wide chunk. The churn argument still
holds; it just needs several chunks.

Kira's Workbox glob is `**/*.{js,css,html,svg,png,ico,json,woff2}` — it precaches every
image in the build. That is fine for SVG and would be ruinous for rasters. If photographs
ever become necessary (plant identification: 虎尾兰 vs 苔藓 may genuinely need one), use
WebP, **exclude them from the glob**, and runtime-cache per topic.

### 3.4 One asset serves many items

Each organ is an addressable `<path id>`, so the same diagram backs the labelling item, an
MCQ that highlights the small intestine and asks which organ absorbs nutrients, and any
classify item on the same topic. That reuse is what keeps the library at roughly **200–250
diagrams for Years 3–6** rather than one per item — the digestion diagram alone appears in
17 of the 81 source worksheets.

Items reference a diagram **by id** (`data.diagram: 'dg-digestive-system'`). Never embed
the markup in the item; that destroys the reuse.

Hotspots live in **viewBox units inside the SVG**, not as CSS-positioned overlays. Labels
then stay pinned to the organ at every screen size with no resize observer.

### 3.5 ⚠️ LICENSING — this decides whether any of it ships

The traced figures are **the publisher's artwork**. The source folder carries Tunas
Pelangi, Penerbitan Bangi and 嘉阳 material. Tracing changes the file format; it does not
change who owns the drawing. A derivative of a copyrighted illustration is still a
derivative.

Fine for a spike and for your own children practising at home. **Not fine for a tuition
product with paying users** — and a Malaysian educational publisher will notice, because
that artwork is their business.

Recommended path: **trace as reference, then redraw.** The traced SVG becomes the layout
brief — anatomy, proportions and hotspot positions all settled — so the illustration job
drops to hours per asset instead of days. Also worth one email about licensing before
assuming it's expensive; a Year 3–6 diagram set is a small, well-defined ask.

The pipeline is the durable asset. Point it at artwork you own and nothing above changes.

---

## 4. Content schema

```ts
type Locale = 'zh' | 'ms' | 'en'
interface LocalizedText { zh: string; ms: string; en: string }

interface BaseItem {
  id: string
  type: ItemType
  sp_code: string    // Standard Pembelajaran, e.g. '3.3.1'
  tp_level: number   // Tahap Penguasaan 1..6
  year: number       // 1..6 — content has a shelf life, see §6
  difficulty: number
  skill_tags: string[]
  prompt: LocalizedText
  explanation: LocalizedText
}
```

**中文 is authoritative.** KPM publishes a separate, fully-Chinese DSKP Sains edition for
SJKC at every year level, so 地下茎, 吸芽, 孢子, 排水法 are *sourced*, not invented. This is
the reverse of Kira's situation, where 254 items carry Claude-authored BM no Malay reader
has checked. **Build the glossary from the DSKP before authoring at volume.** BM is the
assessment language (SP codes, TP bands, the UASA paper); English is the third label.

**Opaque answer keys, not canonical English.** Kira can use `"Trade Payables"` as the
answer space because account names are stable English terms. 孢子 has no privileged
rendering — the moment Chinese is authoritative, an English canon is a translation layer
pointing the wrong way. Keys are meaningless strings (`small-intestine`); all three
languages are display labels.

**Key items on `(sp_code, tp_level)`, not chapter.** Every worksheet carries an SP code and
a TP band, and teachers report 掌握／未掌握 per standard. That is the unit the school
reports in, and per-standard mastery is what a parent would pay to see. Kira's
`weakestSkills()` already does the roll-up in TypeScript — point it at SP codes and the
teacher screens light up for free.

**Distractors are required, not optional.** Year 3 papers routinely offer 8 organ names for
6 slots. Without them the last placement is free and the item silently becomes a 5-question
item.

### 4.1 Known schema gap: shared option banks

Worksheet WA0065 carries **one** word bank of 11 terms shared between the diagram-labelling
part (uses 6) and the cloze passage below it (uses the other 5). The sharing is the
pedagogy, not an accident — the distractors for the diagram *are* the answers to the cloze.

The current schema puts `distractors` on the individual item and cannot express this. It
needs a **`Part`** layer between `Lesson` and `Item`: a group carrying a shared option bank
that several child items draw from, with consumption tracked across the group. Kira has no
equivalent, because a journal entry never shares an account pool with the next question.
**Land this before volume authoring.**

---

## 5. Item types and grading

| Type | From (source worksheets) | Auto-gradable |
|---|---|---|
| `mcq` | 选择题 / 圈出正确的答案 (22 files) | yes |
| `true_false` | 是非题 √/X (6) | yes |
| `cloze` | 填空 with word bank (20) | yes |
| `matching` | 连线 (11), incl. 3-column | yes, needs drag-line UI |
| `classify` | 分类 into groups (10) | yes — reuse Kira's `StatementBuildItem` mechanic |
| `label_diagram` | 标示图 (10) | yes |
| `sequence` | 排列 1–6 (6) | yes |
| `numeric` | 测量读数 (5) | yes — Kira's `NumericItem` transfers directly |
| `short_answer` | 写出原因 / 预测 (13, TP4–6) | **LLM rubric only** |
| `faded_step` | 排水法, 消化过程 | yes — Kira's `FadedStepItem` transfers |

Build `sequence` first: trivially gradable, no images, no LLM, exercises the whole pipeline.

**And the topic picks itself, because two arguments converge on it.** 消化 · Penghadaman is
the largest cluster in the source folder at **17 of 77 files**, and 消化过程 — ordering the
digestive process — *is* the `sequence` type. So the first build needs neither the trace
pipeline nor the LLM grader, and it lands on the best-supported topic in the corpus. Then
营养素／均衡饮食 (15) and 牙齿 · Gigi (14): with digestion that is **46 of 77 files inside a
single theme**. 牙齿 and animal teeth (8) are the two most artwork-dependent topics, so they
follow the §3 spike rather than precede it.

**Partial credit is not optional.** Kira grades all-or-nothing, which is right for a journal
entry — a double entry that doesn't balance is simply wrong. A six-organ diagram scored
all-or-nothing tells a Year 3 pupil nothing, and PBD reports per standard. `GradeResult`
carries `score: 0..1`, a `parts` map, and `placed`/`of`.

**Sequencing is scored on adjacent-pair agreement, not absolute position.** Position
matching punishes a pupil who has the whole chain right but displaced one step — every
later step then reads as wrong, which is demoralising *and* diagnostically false.
**MEASURED:** response `['s6','s1','s2','s3','s4','s5']` scores **0.8** under pair-scoring
and **0** under position matching.

But show the child the absolute count, not the pair score — "3/5 adjacent pairs" is not a
sentence a nine-year-old parses. `placed`/`of` is the headline; `score` is the diagnosis
underneath and the number the scheduler demotes on.

**UI gotchas found only by tapping through it on a phone-shaped screen:**
- A filled slot must be tappable to clear it. Without that, one mis-tap on a six-slot item
  means restarting the question.
- Labels need auto-fit sizing. 小肠 is two full-width glyphs; "Small intestine" is fifteen
  half-width ones. One font size cannot serve both — estimate the run by character class
  and shrink to fit, with a floor around 23 viewBox units.

---

## 6. Curriculum and assessment facts

**UPSR is abolished (2021).** Year 4–6 pupils now sit **UASA** — school-administered but to
a KPM instrument spec: 1 paper, 75 minutes, 50 marks. Bahagian A 10 questions/10 marks,
B 2/8, **C 4 questions/32 marks**. Difficulty ratio rendah:sederhana:tinggi = **5:3:2**.

**Roughly 64% of the paper is extended structured response.** An app that drills MCQ recall
would systematically under-prepare pupils for the paper they actually sit, and would cap at
TP3 on a report that goes to TP6. This is why `short_answer` + an LLM rubric grader
eventually matters. Put it in a Supabase Edge Function (never ship an API key to the
client), grade against the published TP descriptor rather than a model answer, and expect a
new state Kira has never had: *answered but not yet graded* while offline.

**Make the exam blueprint swappable config**, not hard-coded. **MEASURED source:** the
Ministry set an end-of-2026 deadline on a policy review of whether to reinstate UPSR and
PT3 (Malay Mail, 15 Jan 2026). Kira already got this right by accident — `BLUEPRINT` is
data with a test asserting it sums correctly.

**ASSUMED, verify before betting on it:** KP2027 replaces KSSR starting with Year 1 in 2027,
and standalone Sains reportedly disappears at Year 1, folded into an integrated subject
provisionally called *Alam dan Manusia*, returning standalone around Years 5–6. KSSR
Semakan 2017 reportedly runs to ~2031 for cohorts already inside it. This came from
education news and a teacher blog — `bpk.moe.gov.my` was blocked during research. If true,
Year 1 is the one module guaranteed to expire. **Version content per year as independent
modules.**

PBD performance bands TP1–TP6 are the reporting unit. Six fixed themes across all years:
Inkuiri dalam Sains / Sains Hayat / Sains Fizikal / Sains Bahan / Bumi dan Angkasa /
Teknologi dan Kehidupan Lestari.

---

## 7. Risks, honestly

**Content volume is the project.** Everything architectural above is weeks. The content is
a year. Kira reached 356 items for one SPM subject; Years 3–6 of primary Science at
comparable density is plausibly 1,500–2,500 items.

**Illustration throughput is the confirmed bottleneck**, not a hypothetical one — five
revisions for one hand-drawn figure, and the trace pipeline exists precisely to route
around it. Budget for an illustrator or a much better authoring loop.

**Three languages triples the review burden.** DSKP-sourced Chinese mitigates most of it,
but BM and English labels are still authored. Build the `bm-review.mjs` equivalent — a
generated, finite review document — *before* authoring at volume, not after.

**Do not inherit `seed_content.json`'s single-file shape.** Kira's is 13k lines / 577 kB for
one subject and is already the likeliest bad merge in that repo. Split file-per-year or
file-per-topic from the start, with the loader concatenating.

**Port the content guard and its gotcha log on day one**, not after the first bad merge.

---

## 8. Verification status

| Claim | Status |
|---|---|
| Registry refactor: 300 passed / 36 files, typecheck, build | MEASURED (fresh Linux install, `c848c29`) |
| All image sizes in §3.2 | MEASURED (real builds / cairosvg / PIL) |
| Bundling numbers and chunk-hash stability in §3.3 | MEASURED |
| Grading behaviour in §5 | MEASURED (10 passing tests in the spike repo) |
| UASA format and abolition of UPSR | MEASURED (two `moe.gov.my` PDFs) |
| KP2027 / Year 1 Sains removal | **ASSUMED** — news + teacher blog only |
| 200–250 diagram library estimate | **ASSUMED** — extrapolated from 81 worksheets |
| `kaji.accme.my` free, no wildcard on `accme.my`; `kaji.my`/`kajiapp.com`/`getkaji.com` registered | MEASURED (dig + whois, 2026-08-08) |
| Naming, origin and year order (§1.1) | **DECISIONS**, not measurements — Julius, 2026-08-08 |
| Copyright position | **NOT LEGAL ADVICE.** Get a real opinion before selling anything. |

---

## 9. Document status

**This file is canonical.** Where it disagrees with `docs/sains/BUILD_PLAN.md`, this wins —
it separates MEASURED from ASSUMED per claim and carries real numbers, and it supersedes
BUILD_PLAN's image sizing, bundling, UASA format and grading sections outright. BUILD_PLAN
is retained as background: the longer reasoning, the transfer-by-area table and the
fork-vs-share argument that led here.

Two things known to be broken and deliberately not patched, because they are worth fixing
properly rather than quietly:

1. **`scripts/extract-diagram.py` writes to `src/content/diagrams/`** — the shipping content
   path — while §3.5 says traced output must never ship in a product. Its default output
   location contradicts its own licensing warning. §3.5 is the strongest rule in this
   document and the only one with no enforcement behind it. The fix that matches how this
   codebase works elsewhere (the duplicate-id guard, the prod-test guard, the `_test.sql`
   hard stop) is **provenance as a schema field** — `provenance: 'traced' | 'original' |
   'licensed'` on each diagram, plus a content-guard test that fails the build when a
   `traced` asset is referenced by a shipped item. That makes §3.5 unbypassable instead of
   remembered.
2. **The script's docstring cites `SPIKE_FINDINGS.md §9`, which is not on disk.** Either it
   did not come across, or the citation should point at §3.5 here.
