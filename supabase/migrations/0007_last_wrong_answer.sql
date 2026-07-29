-- Kira — what the learner actually answered
-- Paste into the Supabase SQL Editor and run, AFTER 0006_avatars.sql.
-- Safe to re-run: every statement is idempotent.
--
-- Why this exists
--   The teacher's "recently got wrong" panel can already show the question,
--   the right answer and the explanation the learner was given — all of that
--   comes out of the bundled content file. What it cannot show is the one
--   thing that turns a report into a diagnosis: WHICH wrong answer they gave.
--   "3× wrong" tells a parent to worry. "She put returns inwards on the debit
--   side, all three times" tells them what to say next.
--
--   `attempts.chosen` has held that answer since 0001; nothing has ever read
--   it back. learner_item_stats aggregates attempts away deliberately, so
--   this is a separate function rather than more columns on that one — the
--   roster asks "how is she doing", this asks "what did she put".
--
-- Shape
--   One row per item the learner has ever got wrong, carrying the MOST RECENT
--   wrong answer for it. Not every wrong attempt: the teacher is looking at a
--   miss to work out what the misconception is, and the latest one is the
--   current state of it. Bounded by the content bank the same way
--   learner_item_stats is — one row per item, not per attempt — so it cannot
--   outgrow the PostgREST row cap however long the learner practises.
--
--   `chosen` is opaque jsonb here. Its shape is per interaction type and is
--   known only to the client (grading/grade.ts), which is also the only place
--   that can render it — the database has never known what an item IS.
--
-- Security
--   SECURITY DEFINER, so it bypasses RLS and the guard inside IS the boundary.
--   It repeats BOTH checks from learner_item_stats: the caller owns the class,
--   AND the learner is a member of THAT class. Owning some class must never be
--   enough to read an arbitrary user's answers. This function is strictly more
--   sensitive than the roster ones — it returns what a learner typed, not a
--   count — so the guard is the same and the tests on it are harder.

create or replace function public.learner_last_wrong(
  p_class_id uuid,
  p_user_id  uuid
)
returns table (
  item_id    text,
  chosen     jsonb,
  wrong_at   timestamptz
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not public.owns_class(p_class_id) then
    raise exception 'not the owner of this class' using errcode = '42501';
  end if;
  -- Owning SOME class must not be enough to read an arbitrary user: the
  -- learner has to be in THIS one.
  if not exists (
    select 1 from public.class_members cm
    where cm.class_id = p_class_id and cm.user_id = p_user_id
  ) then
    raise exception 'not a member of this class' using errcode = '42501';
  end if;

  return query
  -- distinct on + order by is Postgres's cheapest "latest row per group", and
  -- it uses the existing (user_id, created_at desc) index on attempts.
  select distinct on (a.item_id)
    a.item_id,
    a.chosen,
    a.created_at as wrong_at
  from public.attempts a
  where a.user_id = p_user_id
    and not a.correct
  order by a.item_id, a.created_at desc;
end;
$$;

revoke all on function public.learner_last_wrong(uuid, uuid) from public;
-- anon as well as authenticated: create_class is reachable anonymously, so an
-- anonymous owner must still be able to read their own class's detail.
grant execute on function public.learner_last_wrong(uuid, uuid) to anon, authenticated;
