# Bookkeeping Learning App — Build Spec (v1)

*Hand-off document for the Claude Code build session. Working name: **Kira**.*

---

## 1. What we're building

A mobile-first, installable PWA that teaches bookkeeping through **short retrieval-practice sessions**, with progress synced across devices and full offline capability. Bilingual (Bahasa Malaysia / English). Content is aligned to the SPM Prinsip Perakaunan progression we've already built (Stages 1–4), but the content model is syllabus-agnostic so it can extend later.

**Audience decision:** built for one learner now (my daughter), architected to become a JC Labs product later. That means: no hardcoded content, clean tenant-neutral schema, content authored as data not code.

---

## 2. Learning design — principles → concrete mechanics

Each feature below is tied to a research-backed principle. This is the part that must not get diluted during the build.

| Principle (evidence) | How the app implements it |
|---|---|
| **Retrieval practice** — testing beats re-reading; among the two highest-impact techniques in the meta-analytic literature | Every session is *questions*, never passive notes. Concepts are introduced through a worked example, then immediately practised. |
| **Spaced repetition** — distributed practice yields 2–3× retention vs. massed review | A Leitner-box scheduler resurfaces items at growing intervals. Wrong answers drop back to Box 1; correct answers climb. |
| **Faded worked examples (backward fading)** — novices learn procedures from a model, with steps removed last-first as skill grows | Each new skill runs: **fully worked → last step blank → last two blank → cold solve**. This is our existing "I do / we do / you do" flow. |
| **Immediate feedback + self-explanation** | Instant right/wrong with a one-line *why*. Periodic "why did you choose that?" prompts on error-prone items (debit/credit direction, provision-before-vs-after-writeoff). |
| **Desirable difficulty / cognitive load** | ≤4 new items introduced per session; one skill per micro-lesson; short 5–10 min sessions. |

---

## 3. Content model (the spine — get this right first)

Content is **data, not code**. Bundled as JSON for the MVP; movable to Supabase later for a multi-tenant author UI.

```
Topic ─▶ Lesson ─▶ Item[]
```

**Item schema:**
```json
{
  "id": "je-basic-001",
  "type": "journal_entry",
  "skill_tags": ["double-entry", "debit-credit"],
  "difficulty": 2,
  "prompt": { "en": "...", "ms": "..." },
  "data": { /* type-specific: accounts, amounts, scenario */ },
  "answer": { /* canonical correct answer */ },
  "explanation": { "en": "...", "ms": "..." }
}
```

**Question / interaction types (build in this order):**
1. **Classify** — tap: Asset / Liability / Equity / Income / Expense
2. **Debit or Credit** — tap the correct side
3. **Journal entry builder** — pick accounts + amounts; must balance (Dr = Cr) to submit
4. **T-account posting** — drag amounts to the correct side; compute closing balance
5. **Spot the error** — identify the wrong entry and correct it *(later)*
6. **Faded step** — fill the blank step in a partially-worked solution *(later — this is the fading mechanic)*
7. **Statement build** — trial balance → income statement / balance sheet *(Stage 3+)*

**Seed content:** port Stages 1–4 from our existing material (`Bookkeeping_Practice_Day1–4`, both EN and BM) into the item format. That's the starting question bank.

---

## 4. Tech stack

- **Frontend:** Vite + React + TypeScript, Tailwind. Keep the bundle lean for mobile.
- **Offline store:** IndexedDB via **Dexie**. All reads/writes hit local first.
- **PWA:** Workbox service worker — app-shell precache + offline fallback; web manifest for home-screen install.
- **Backend / sync:** **Supabase** (Postgres + Auth). Start with **anonymous auth** (zero login friction); allow upgrade to email later so progress binds to an account.
- **Sync model:** local-first. A sync queue flushes attempts + review-state to Supabase when online; last-write-wins on conflict for the MVP.
- **Hosting:** GitHub Pages under `juliusdx.github.io` (or Vercel if you want push-to-deploy previews). Repo: new `kira` repo.

---

## 5. Supabase schema (MVP)

```sql
-- one row per learner
profiles (
  id uuid primary key references auth.users,
  display_name text,
  locale text default 'ms',      -- 'ms' | 'en'
  created_at timestamptz default now()
)

-- Leitner review state, one row per (user, item)
review_state (
  user_id uuid references auth.users,
  item_id text,
  box int default 1,             -- 1..5
  due_at timestamptz,
  streak int default 0,
  last_result boolean,
  updated_at timestamptz default now(),
  primary key (user_id, item_id)
)

-- every answer, for analytics + mastery
attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  item_id text,
  correct boolean,
  chosen jsonb,                  -- what they answered
  ms_taken int,
  created_at timestamptz default now()
)
```

Enable **RLS** on all tables: a user reads/writes only their own rows (`auth.uid() = user_id`). Content stays app-bundled for MVP, so no content tables yet — but leave room for `topics`, `lessons`, `items`, `orgs` when it goes multi-tenant.

---

## 6. Spaced-repetition scheduler (isolate this module)

Start with **Leitner** — simple, proven, easy to reason about. Keep it a **pure function module** (`scheduler.ts`) with a clean interface so FSRS can drop in later without touching the UI.

- Boxes 1–5, intervals: `0` (same session) · `1d` · `3d` · `7d` · `21d`
- Correct → box + 1 (cap 5); wrong → back to box 1
- Session queue = due items (`due_at <= now`) + up to N new items (cap ~4/session)
- Interleave types within a session (don't batch all one type — interleaving aids discrimination)

---

## 7. MVP build order

1. Vite + PWA scaffold; installable; offline app-shell working
2. Content model + Dexie local store; seed Stage 1–2 items (EN + BM)
3. Question types 1–4 with instant feedback + explanations
4. `scheduler.ts` (Leitner) + session/review queue
5. Anonymous Supabase auth + sync queue (local ⇄ cloud)
6. Progress view: streak, per-topic mastery %, due-today count
7. BM/EN language toggle (persisted to profile)

**Deferred (post-MVP):** Stages 3–5 content · spot-the-error + faded-step types · email login/account upgrade · richer analytics · FSRS scheduler · multi-tenant author UI + leaderboard (the JC Labs product path).

---

## 8. First commands for the Claude Code session

```
- Scaffold Vite + React + TS + Tailwind PWA (vite-plugin-pwa/Workbox)
- Add Dexie; define local schema mirroring §5
- Build content loader + seed Stage 1 items from our existing BM/EN material
- Implement question types 1–2, then 3–4, each with feedback + explanation
- Implement scheduler.ts (Leitner) with unit tests
- Wire Supabase (anon auth) + sync queue
- Deploy to GitHub Pages; verify install + offline on phone
```

Point the session at this spec and at the `Bookkeeping_Practice_Day1–4` files for seed content. Confirm the Supabase project/cost in-session before provisioning.
