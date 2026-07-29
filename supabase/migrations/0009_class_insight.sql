-- Kira — consistency, and what the CLASS is weak at
-- Paste into the Supabase SQL Editor and run, AFTER 0008_item_notes.sql.
-- Safe to re-run: every statement is idempotent.
--
-- Why these two
--   The roster answers "how is this learner doing" well enough. It does not
--   answer either of the two questions a teacher asks next.
--
--   1. Is she actually coming back? Mastery and accuracy both look fine on an
--      account that has not been opened in a fortnight — the number that
--      matters for spaced repetition is how many DAYS were practised, not how
--      many items. The app's own leaderboard metric was chosen for exactly
--      this reason; the teacher's roster never showed it.
--
--   2. What is the whole class weak at? Per-learner drilling does not scale
--      past one child. A teacher with a class needs the topic to reteach, not
--      six separate reading exercises.
--
-- Why class_item_stats returns ITEMS and not skills
--   Because SQL has never known what an item IS in this project — that is the
--   same rule that keeps `chosen` opaque in 0007 and keeps item_id free of a
--   foreign key in 0008. Skill tags live in seed_content.json, which is client
--   data, so this returns per-item counts and the client rolls them up through
--   the SAME weakestSkills() code the per-learner view uses. One definition of
--   "weak", not two that can drift.
--
--   It is bounded by the size of the content bank (one row per item ever
--   attempted in the class, ~253 today), not by attempts or learners, so it
--   cannot outgrow the PostgREST row cap however long the class runs.
--
-- Security
--   Both are SECURITY DEFINER, so the guard inside each IS the boundary. Both
--   are owner-only: unlike learner_item_stats there is no per-learner argument
--   to check, because the answer covers the whole class the caller owns.
--   class_activity returns one row per member and NO answer content — when a
--   learner practised, never what they put.

-- ---------------------------------------------------------------------------
-- 1. Did they come back? Seven days, one boolean each.
--
-- The timezone is the CALLER's, passed in from the browser, because this is
-- read on the teacher's screen and "today" should mean the teacher's today.
-- An unrecognised zone falls back to UTC rather than raising: a progress
-- report should not fail to load because a device reported an odd locale.
-- ---------------------------------------------------------------------------
create or replace function public.class_activity(
  p_class_id uuid,
  p_tz       text default 'UTC'
)
returns table (
  user_id uuid,
  -- 7 entries, oldest first: index 7 is today in p_tz.
  days    boolean[]
)
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_tz text;
begin
  if not public.owns_class(p_class_id) then
    raise exception 'not the owner of this class' using errcode = '42501';
  end if;

  select p_tz into v_tz
  where exists (select 1 from pg_timezone_names z where z.name = p_tz);
  v_tz := coalesce(v_tz, 'UTC');

  return query
  with members as (
    select m.user_id from public.class_members m where m.class_id = p_class_id
  ),
  -- the 7 dates being reported, in the caller's zone
  span as (
    select ((now() at time zone v_tz)::date - offs) as d
    from generate_series(6, 0, -1) as offs
  ),
  practised as (
    select distinct
      a.user_id,
      (a.created_at at time zone v_tz)::date as d
    from public.attempts a
    join members mm on mm.user_id = a.user_id
    where a.created_at >= (now() - interval '8 day')
  )
  select
    mm.user_id,
    array_agg(
      exists (
        select 1 from practised p
        where p.user_id = mm.user_id and p.d = s.d
      )
      order by s.d
    ) as days
  from members mm
  cross join span s
  group by mm.user_id;
end;
$$;

revoke all on function public.class_activity(uuid, text) from public;
-- anon too: create_class is reachable anonymously, so an anonymous owner is a
-- real teacher.
grant execute on function public.class_activity(uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. What is the class getting wrong? Per ITEM — the client turns items into
--    skills, because that mapping is content and content is client data.
-- ---------------------------------------------------------------------------
create or replace function public.class_item_stats(p_class_id uuid)
returns table (
  item_id  text,
  attempts bigint,
  wrong    bigint,
  -- how many DISTINCT learners have got this wrong. One learner failing an
  -- item six times is a conversation with that learner; four learners failing
  -- it once each is a reteach, and the totals alone cannot tell them apart.
  learners bigint
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
  select
    a.item_id,
    count(*)                                             as attempts,
    count(*) filter (where not a.correct)                 as wrong,
    count(distinct a.user_id) filter (where not a.correct) as learners
  from public.attempts a
  join public.class_members m
    on m.user_id = a.user_id
   and m.class_id = p_class_id
  group by a.item_id;
end;
$$;

revoke all on function public.class_item_stats(uuid) from public;
grant execute on function public.class_item_stats(uuid) to anon, authenticated;
