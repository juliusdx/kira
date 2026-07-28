-- Kira — server-side roster roll-up (teacher / parent progress tracking)
-- Paste into the Supabase SQL Editor and run, AFTER 0004_push_reminders.sql.
-- Safe to re-run: every statement is idempotent.
--
-- Why this exists
--   The roster used to be built client-side: fetch EVERY review_state row and
--   EVERY attempt row for every member, then roll them up in JS. That is wrong
--   in a way that gets worse the more the app is used — PostgREST caps a
--   response at the project's "Max rows" setting (Supabase default 1000) and
--   TRUNCATES SILENTLY. With 186 items, half a dozen active learners exceeds
--   that on review_state alone, and one busy learner exceeds it on attempts
--   within weeks. Nothing errors; the teacher just starts seeing mastery,
--   accuracy and weak-skill numbers computed from an arbitrary slice.
--
--   Aggregating in Postgres fixes the correctness problem and collapses the
--   payload to one row per learner.
--
-- What deliberately stays in the client
--   Topics and items live in the bundled content file, not in Postgres — the
--   database only ever sees an opaque item_id. So SQL does only the arithmetic
--   that needs no content knowledge, and the client maps items to topics and
--   skills using its own bundle. Mastery WEIGHTING likewise stays in
--   scheduler.ts: this function returns the raw box histogram instead of a
--   score, so the weighting rule has exactly one home and cannot drift between
--   TypeScript and SQL.
--
-- Security
--   Both functions are SECURITY DEFINER, so they bypass RLS and the guard
--   inside each one IS the boundary. Each checks ownership explicitly, and
--   learner_item_stats additionally checks that the learner is a member of the
--   class being asked about — otherwise owning any class at all would be
--   enough to read any user's history.

-- ---------------------------------------------------------------------------
-- Per-learner summary for one class. One row per member, including members
-- who have never practised.
-- ---------------------------------------------------------------------------
create or replace function public.class_roster(p_class_id uuid)
returns table (
  user_id        uuid,
  display_name   text,
  joined_at      timestamptz,
  last_active_at timestamptz,
  seen           bigint,
  mastered       bigint,
  due            bigint,
  box_counts     bigint[],   -- boxes 1..5, so the client can apply its own
                             -- mastery weighting
  attempts       bigint,
  correct        bigint
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

  return query
  with members as (
    select m.user_id, m.joined_at
    from public.class_members m
    where m.class_id = p_class_id
  ),
  rev as (
    select
      r.user_id,
      count(*)                                  as seen,
      count(*) filter (where r.box >= 5)        as mastered,
      count(*) filter (where r.due_at <= now()) as due,
      array[
        count(*) filter (where r.box = 1),
        count(*) filter (where r.box = 2),
        count(*) filter (where r.box = 3),
        count(*) filter (where r.box = 4),
        count(*) filter (where r.box = 5)
      ]                                         as box_counts,
      max(r.updated_at)                         as last_review_at
    from public.review_state r
    join members mm on mm.user_id = r.user_id
    group by r.user_id
  ),
  att as (
    select
      a.user_id,
      count(*)                          as attempts,
      count(*) filter (where a.correct) as correct,
      max(a.created_at)                 as last_attempt_at
    from public.attempts a
    join members mm on mm.user_id = a.user_id
    group by a.user_id
  )
  select
    m.user_id,
    nullif(btrim(p.display_name), '')                      as display_name,
    m.joined_at,
    -- GREATEST ignores NULLs, so a learner with only reviews (or only
    -- attempts) still reports the timestamp they do have.
    greatest(rev.last_review_at, att.last_attempt_at)      as last_active_at,
    coalesce(rev.seen, 0)                                  as seen,
    coalesce(rev.mastered, 0)                              as mastered,
    coalesce(rev.due, 0)                                   as due,
    coalesce(rev.box_counts, array[0,0,0,0,0]::bigint[])   as box_counts,
    coalesce(att.attempts, 0)                              as attempts,
    coalesce(att.correct, 0)                               as correct
  from members m
  left join public.profiles p on p.id = m.user_id
  left join rev on rev.user_id = m.user_id
  left join att on att.user_id = m.user_id
  -- most recently active first; never-active last
  order by greatest(rev.last_review_at, att.last_attempt_at) desc nulls last,
           m.joined_at asc;
end;
$$;

-- ---------------------------------------------------------------------------
-- Per-ITEM history for ONE learner, so the teacher can see WHERE a learner is
-- struggling rather than only that they are. Bounded by the size of the
-- content bank (one row per item the learner has touched), so it cannot grow
-- without bound the way raw attempts do.
-- ---------------------------------------------------------------------------
create or replace function public.learner_item_stats(
  p_class_id uuid,
  p_user_id  uuid
)
returns table (
  item_id       text,
  box           int,
  due_at        timestamptz,
  attempts      bigint,
  wrong         bigint,
  last_wrong_at timestamptz,
  last_at       timestamptz
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
  select
    coalesce(r.item_id, a.item_id)  as item_id,
    r.box,
    r.due_at,
    coalesce(a.attempts, 0)         as attempts,
    coalesce(a.wrong, 0)            as wrong,
    a.last_wrong_at,
    a.last_at
  from (
    select rs.item_id, rs.box, rs.due_at
    from public.review_state rs
    where rs.user_id = p_user_id
  ) r
  -- FULL OUTER so an item with attempts but no review row (or the reverse)
  -- is still reported rather than silently dropped.
  full outer join (
    select
      at2.item_id,
      count(*)                                          as attempts,
      count(*) filter (where not at2.correct)           as wrong,
      max(at2.created_at) filter (where not at2.correct) as last_wrong_at,
      max(at2.created_at)                               as last_at
    from public.attempts at2
    where at2.user_id = p_user_id
    group by at2.item_id
  ) a on a.item_id = r.item_id;
end;
$$;

revoke all on function public.class_roster(uuid)              from public;
revoke all on function public.learner_item_stats(uuid, uuid)  from public;
-- anon as well as authenticated: create_class is reachable anonymously, so an
-- anonymous owner must still be able to read their own roster.
grant execute on function public.class_roster(uuid)             to anon, authenticated;
grant execute on function public.learner_item_stats(uuid, uuid) to anon, authenticated;
