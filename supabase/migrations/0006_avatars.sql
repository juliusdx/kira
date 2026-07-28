-- Kira — learner avatars
-- Paste into the Supabase SQL Editor and run, AFTER 0005_roster_rollup.sql.
-- Safe to re-run: every statement is idempotent.
--
-- Why a column
--   Everyone already HAS a face: the client derives one from the user id, so a
--   leaderboard is never a wall of identical blanks. This column is only for
--   the face a learner has CHOSEN, and it exists so that choice follows the
--   account to a new device and is what classmates and the teacher actually
--   see — none of which is possible while it lives in local storage.
--
-- Why an emoji and not an upload
--   No file storage, no moderation queue, and no question about a child's
--   photograph sitting in a database. It also renders identically everywhere.
--
-- Why a CHECK constraint and not client-side validation
--   profiles has a self-service RLS policy from 0001, so a learner can write
--   their own row directly. Without a constraint anyone could set their
--   "avatar" to arbitrary text, and that text renders on their classmates'
--   leaderboard and on their teacher's roster. It is not an injection risk (it
--   is drawn as text, never as markup) but a classroom app should not let one
--   pupil put whatever they like in front of the others. The allow-list is the
--   boundary, and it holds no matter which write path is used.
--
--   src/app/avatar.test.ts asserts this list and the TypeScript AVATARS array
--   stay identical, so the two cannot drift apart unnoticed.

alter table public.profiles
  add column if not exists avatar text;

-- Re-runnable: drop before adding, since ADD CONSTRAINT has no IF NOT EXISTS.
alter table public.profiles
  drop constraint if exists profiles_avatar_allowed;
alter table public.profiles
  add constraint profiles_avatar_allowed check (
    avatar is null or avatar in (
      '🦊','🐼','🦉','🐬','🦁','🐢','🦋','🐝',
      '🦄','🐙','🐧','🦜','🐳','🦔','🐨','🐸'
    )
  );

-- ---------------------------------------------------------------------------
-- Setter, mirroring set_display_name. Passing null clears the choice and the
-- learner falls back to their derived face.
-- ---------------------------------------------------------------------------
create or replace function public.set_avatar(p_avatar text)
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
  v_clean := nullif(btrim(coalesce(p_avatar, '')), '');
  -- the CHECK constraint rejects anything not on the list
  update public.profiles set avatar = v_clean where id = auth.uid();
  return v_clean;
end;
$$;

revoke all on function public.set_avatar(text) from public;
grant execute on function public.set_avatar(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Surface the avatar wherever a learner is shown to someone else. Both
-- functions are otherwise unchanged from 0003 / 0005 — only the extra column
-- is new, so re-running this file is the whole update.
-- ---------------------------------------------------------------------------
drop function if exists public.class_leaderboard(uuid, timestamptz);
create function public.class_leaderboard(
  p_class_id uuid,
  p_since    timestamptz
)
returns table (
  user_id      uuid,
  display_name text,
  avatar       text,
  score        bigint
)
language plpgsql
security definer
stable
set search_path = public
as $$
begin
  if not (public.is_member_of(p_class_id) or public.owns_class(p_class_id)) then
    raise exception 'not a member of this class' using errcode = '42501';
  end if;

  return query
    select
      m.user_id,
      coalesce(nullif(btrim(p.display_name), ''), 'Learner') as display_name,
      p.avatar,
      count(distinct a.item_id) as score
    from public.class_members m
    left join public.profiles p
      on p.id = m.user_id
    left join public.attempts a
      on a.user_id = m.user_id
     and a.created_at >= p_since
    where m.class_id = p_class_id
    group by m.user_id, p.display_name, p.avatar
    order by count(distinct a.item_id) desc, display_name asc;
end;
$$;

revoke all on function public.class_leaderboard(uuid, timestamptz) from public;
grant execute on function public.class_leaderboard(uuid, timestamptz)
  to anon, authenticated;

drop function if exists public.class_roster(uuid);
create function public.class_roster(p_class_id uuid)
returns table (
  user_id        uuid,
  display_name   text,
  avatar         text,
  joined_at      timestamptz,
  last_active_at timestamptz,
  seen           bigint,
  mastered       bigint,
  due            bigint,
  box_counts     bigint[],
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
    p.avatar,
    m.joined_at,
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
  order by greatest(rev.last_review_at, att.last_attempt_at) desc nulls last,
           m.joined_at asc;
end;
$$;

revoke all on function public.class_roster(uuid) from public;
grant execute on function public.class_roster(uuid) to anon, authenticated;
