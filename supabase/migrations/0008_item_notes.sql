-- Kira — the teacher's better explanation, kept
-- Paste into the Supabase SQL Editor and run, AFTER 0007_last_wrong_answer.sql.
-- Safe to re-run: every statement is idempotent.
--
-- Why this exists
--   The "recently got wrong" panel already lets a teacher read the explanation
--   the learner was given and write a better one. Until now that box was not
--   saved — it was copied into an authoring brief or it was lost, and the UI
--   said so. That was the honest thing to ship without a table, but it means
--   the one artefact in the whole loop that only a human can produce is also
--   the only one that does not survive leaving the page.
--
-- Shape
--   One row per (author, item). A better explanation for `l30-balance-off` is a
--   better explanation for it whoever missed it, so the note is keyed to the
--   ITEM, not to the learner whose miss prompted it. Keying it per learner
--   would make a teacher write the same sentence once per child.
--
--   item_id is a bare text id with no foreign key, exactly like review_state
--   and attempts: content is bundled in the client, and the database has never
--   known what an item IS. A note therefore survives the item being re-authored
--   and simply goes unread if the item is removed.
--
-- Security
--   Ordinary self-service RLS — `auth.uid() = author_id` on every path — and
--   NOT SECURITY DEFINER. This is the first thing since 0001 that needs no
--   guard inside a function, because nobody but the author ever reads a note:
--
--     * A teacher reads their own notes. That is the entire read path.
--     * Learners never see them. Free text written by one user and rendered to
--       another is precisely the surface `profiles.avatar` needed an allow-list
--       to close (0006). Author-only means there is nothing to moderate, no
--       abuse path onto a child's screen, and no reason to sanitise on read.
--     * A teacher cannot read another teacher's note, so a shared item id
--       leaks nothing between accounts.
--
--   The length bound is a CHECK and not client-side validation for the 0006
--   reason: the table is self-service under RLS, so a direct write bypasses any
--   UI. 2000 characters is a long paragraph and far short of blob storage.

create table if not exists public.item_notes (
  author_id  uuid not null references auth.users on delete cascade,
  item_id    text not null,
  note       text not null,
  updated_at timestamptz not null default now(),
  primary key (author_id, item_id)
);

-- Re-runnable: ADD CONSTRAINT has no IF NOT EXISTS.
alter table public.item_notes
  drop constraint if exists item_notes_note_length;
alter table public.item_notes
  add constraint item_notes_note_length check (
    length(note) between 1 and 2000
  );

-- An empty note is a DELETE, never a stored empty string: "I cleared this" and
-- "I wrote nothing here" must not be two different states the UI has to explain.
-- The CHECK above enforces that no matter which write path is used.

-- ---------------------------------------------------------------------------
-- updated_at is set server-side, unlike review_state's. There it is the
-- client's clock on purpose, because last-write-wins reconciliation needs the
-- writer's timestamp. A note has exactly one writer and no reconciliation, so
-- the database's own clock is both simpler and not falsifiable.
-- ---------------------------------------------------------------------------
create or replace function public.touch_item_note()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists item_notes_touch on public.item_notes;
create trigger item_notes_touch
  before insert or update on public.item_notes
  for each row execute function public.touch_item_note();

-- ---------------------------------------------------------------------------
-- RLS. This is the only boundary — Kira ships a publishable key in a public
-- bundle.
-- ---------------------------------------------------------------------------
alter table public.item_notes enable row level security;

drop policy if exists "item_notes are self-service" on public.item_notes;
create policy "item_notes are self-service" on public.item_notes
  for all
  using      (auth.uid() = author_id)
  with check (auth.uid() = author_id);

-- anon as well as authenticated: create_class is reachable anonymously, so an
-- anonymous class owner is a real teacher and must be able to keep notes.
grant select, insert, update, delete on public.item_notes to anon, authenticated;
