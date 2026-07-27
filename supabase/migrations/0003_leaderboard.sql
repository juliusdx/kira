-- Kira — class leaderboard (gamification)
-- Paste into the Supabase SQL Editor and run, AFTER 0002_classes.sql.
-- Safe to re-run: every statement is idempotent.
--
-- Why a function instead of new RLS policies
--   A leaderboard needs classmates to see each other, but 0002 deliberately
--   keeps learners blind to one another — a member is not a teacher, and
--   review_state / attempts stay private. Loosening those policies to enable a
--   leaderboard would expose every raw answer to every classmate.
--
--   This SECURITY DEFINER function is the narrow alternative: it returns ONLY
--   (rank, display name, score) for a class the caller actually belongs to.
--   The underlying tables stay locked down; no policy is weakened.
--
-- The metric: distinct items practised in the window. It is self-capping —
-- there are only so many items, and hammering one repeatedly counts once — so
-- it rewards steady review rather than grinding. Ranking by raw XP would
-- reward volume and pull learners away from their due reviews, which is the
-- behaviour spaced repetition exists to produce.

create or replace function public.class_leaderboard(
  p_class_id uuid,
  p_since    timestamptz
)
returns table (
  user_id      uuid,
  display_name text,
  score        bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  -- The caller must be IN the class or OWN it. Without this guard a definer
  -- function would happily leak any class's roster to anyone who knows an id.
  if not (public.is_member_of(p_class_id) or public.owns_class(p_class_id)) then
    raise exception 'not a member of this class' using errcode = '42501';
  end if;

  return query
    select
      m.user_id,
      coalesce(nullif(btrim(p.display_name), ''), 'Learner') as display_name,
      count(distinct a.item_id) as score
    from public.class_members m
    left join public.profiles p
      on p.id = m.user_id
    left join public.attempts a
      on a.user_id = m.user_id
     and a.created_at >= p_since
    where m.class_id = p_class_id
    group by m.user_id, p.display_name
    -- every member appears, including those who have practised nothing yet
    order by count(distinct a.item_id) desc, display_name asc;
end;
$$;

revoke all on function public.class_leaderboard(uuid, timestamptz) from public;
grant execute on function public.class_leaderboard(uuid, timestamptz)
  to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Let a learner set their own display name, so the leaderboard is readable.
-- profiles already has a self-service policy from 0001; this just makes the
-- intent explicit and keeps the column trimmed to something sane.
-- ---------------------------------------------------------------------------
create or replace function public.set_display_name(p_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_clean := nullif(btrim(left(p_name, 24)), '');
  update public.profiles set display_name = v_clean where id = auth.uid();
  return v_clean;
end;
$$;

revoke all on function public.set_display_name(text) from public;
grant execute on function public.set_display_name(text) to anon, authenticated;
