-- Kira — classroom / teacher model (Build Spec §4 extension)
-- Paste this into the Supabase SQL Editor and run it, AFTER 0001_init.sql.
-- Safe to re-run: every statement is idempotent.
--
-- Model
--   A teacher is any user who owns a `classes` row. Learners join a class with
--   a short code (via the join_class RPC). A teacher may READ — never write —
--   the review_state / attempts / profile of learners in their own classes.
--
-- The single most important security property: a teacher can ONLY read a
-- learner who has themselves joined one of the teacher's classes. There is no
-- path for a teacher to add an arbitrary user to a class, so a teacher can
-- never gain read access to someone who never opted in. Enforced by:
--   * the only INSERT into class_members is join_class(), which inserts
--     auth.uid() (the caller) and nobody else, and
--   * class_members has NO direct INSERT/UPDATE policy (default-deny), so
--     PostgREST cannot be used to forge a membership.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table if not exists public.classes (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users on delete cascade,
  name       text not null,
  join_code  text not null unique,
  revoked    boolean not null default false,
  created_at timestamptz not null default now()
);

-- (added after review) allow re-running over an earlier install of this file
alter table public.classes
  add column if not exists revoked boolean not null default false;

create index if not exists classes_owner_idx on public.classes (owner_id);

create table if not exists public.class_members (
  class_id  uuid not null references public.classes on delete cascade,
  user_id   uuid not null references auth.users   on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (class_id, user_id)
);

-- "which classes is this learner in" and "who is in this class"
create index if not exists class_members_user_idx  on public.class_members (user_id);
create index if not exists class_members_class_idx on public.class_members (class_id);

-- ---------------------------------------------------------------------------
-- SECURITY DEFINER helpers.
-- RLS policies that cross-reference classes <-> class_members would recurse
-- (each table's policy querying the other). These helpers run with the
-- definer's rights, so the lookups inside them DO NOT re-trigger RLS, breaking
-- the cycle. They are STABLE and read-only.
-- ---------------------------------------------------------------------------

-- Does the current user OWN the given class?
create or replace function public.owns_class(cls uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.classes c
    where c.id = cls and c.owner_id = auth.uid()
  );
$$;

-- Is the current user a MEMBER of the given class?
create or replace function public.is_member_of(cls uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.class_members m
    where m.class_id = cls and m.user_id = auth.uid()
  );
$$;

-- Is the current user the teacher of SOME class that `member` belongs to?
-- This is the gate for a teacher reading a learner's progress.
create or replace function public.is_teacher_of(member uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.class_members m
    join public.classes c on c.id = m.class_id
    where m.user_id = member
      and c.owner_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- RPCs. Membership is only ever created through these, never by direct writes.
-- ---------------------------------------------------------------------------

-- Create a class owned by the caller, generating a unique join code.
--
-- The code is 12 hex chars (48 bits, ~2.8e14). A 6-char code was only 24 bits
-- — enumerable in hours against join_class, which would let an attacker sweep
-- the space, self-enrol into arbitrary classes and read their metadata. Entropy
-- is what closes that; the UI formats the code in groups so it stays typeable.
create or replace function public.create_class(p_name text)
returns public.classes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_row  public.classes;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- Cap classes per owner: create_class is reachable by any throwaway
  -- anonymous session, so without this the table can be spammed without bound.
  if (select count(*) from public.classes where owner_id = auth.uid()) >= 50 then
    raise exception 'class limit reached' using errcode = '53400';
  end if;

  -- retry on the (astronomically unlikely) code collision
  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 12));
    begin
      insert into public.classes (owner_id, name, join_code)
      values (auth.uid(), coalesce(nullif(btrim(p_name), ''), 'My Class'), v_code)
      returning * into v_row;
      return v_row;
    exception when unique_violation then
      -- code already taken; loop and try another
    end;
  end loop;
end;
$$;

-- Join the class with the given code. Inserts the CALLER as a member; there is
-- deliberately no way to enrol anyone else. Returns the class id.
create or replace function public.join_class(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_class_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  -- accept a code typed with spaces or dashes (the UI shows it grouped)
  select id into v_class_id
  from public.classes
  where join_code = upper(translate(btrim(p_code), ' -', ''))
    and not revoked;

  if v_class_id is null then
    raise exception 'invalid join code' using errcode = 'no_data_found';
  end if;

  insert into public.class_members (class_id, user_id)
  values (v_class_id, auth.uid())
  on conflict (class_id, user_id) do nothing;

  return v_class_id;
end;
$$;

-- Issue a fresh join code for a class the caller owns, so a leaked or
-- over-shared code can be retired without losing the existing roster.
create or replace function public.rotate_join_code(p_class_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.owns_class(p_class_id) then
    raise exception 'not the owner of this class' using errcode = '42501';
  end if;

  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 12));
    begin
      update public.classes
        set join_code = v_code, revoked = false
        where id = p_class_id;
      return v_code;
    exception when unique_violation then
      -- code already taken; loop and try another
    end;
  end loop;
end;
$$;

revoke all on function public.create_class(text)     from public;
revoke all on function public.join_class(text)       from public;
revoke all on function public.rotate_join_code(uuid) from public;
grant execute on function public.create_class(text)     to anon, authenticated;
grant execute on function public.join_class(text)       to anon, authenticated;
grant execute on function public.rotate_join_code(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.classes       enable row level security;
alter table public.class_members enable row level security;

-- classes: a teacher fully manages their own; members may read (to see the
-- class name they belong to). No membership INSERT path lives here.
drop policy if exists "read own or joined classes" on public.classes;
create policy "read own or joined classes" on public.classes
  for select
  using (owner_id = auth.uid() or public.is_member_of(id));

drop policy if exists "teacher inserts own class" on public.classes;
create policy "teacher inserts own class" on public.classes
  for insert
  with check (owner_id = auth.uid());

drop policy if exists "teacher updates own class" on public.classes;
create policy "teacher updates own class" on public.classes
  for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "teacher deletes own class" on public.classes;
create policy "teacher deletes own class" on public.classes
  for delete
  using (owner_id = auth.uid());

-- class_members: readable by the member themselves and by the class's teacher.
-- A member may remove themselves; a teacher may remove anyone from their class.
-- There is NO insert/update policy: joining goes through join_class() only.
drop policy if exists "read own or taught memberships" on public.class_members;
create policy "read own or taught memberships" on public.class_members
  for select
  using (user_id = auth.uid() or public.owns_class(class_id));

drop policy if exists "leave or be removed" on public.class_members;
create policy "leave or be removed" on public.class_members
  for delete
  using (user_id = auth.uid() or public.owns_class(class_id));

-- ---------------------------------------------------------------------------
-- Teacher READ access to learner data. These are additive SELECT-only policies
-- alongside the existing self-service policies from 0001, so a teacher can see
-- a member's rows but the write policies (still auth.uid() = user_id) mean a
-- teacher can never modify them.
-- ---------------------------------------------------------------------------
drop policy if exists "teachers read members' review_state" on public.review_state;
create policy "teachers read members' review_state" on public.review_state
  for select
  using (public.is_teacher_of(user_id));

drop policy if exists "teachers read members' attempts" on public.attempts;
create policy "teachers read members' attempts" on public.attempts
  for select
  using (public.is_teacher_of(user_id));

drop policy if exists "teachers read members' profiles" on public.profiles;
create policy "teachers read members' profiles" on public.profiles
  for select
  using (public.is_teacher_of(id));
