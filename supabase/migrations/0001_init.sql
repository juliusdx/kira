-- Kira — initial schema (Build Spec §5)
-- Paste this into the Supabase SQL Editor and run it.
-- Safe to re-run: every statement is idempotent.

-- ---------------------------------------------------------------------------
-- profiles: one row per learner
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text,
  locale       text not null default 'ms' check (locale in ('ms', 'en')),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- review_state: Leitner state, one row per (user, item)
-- ---------------------------------------------------------------------------
create table if not exists public.review_state (
  user_id     uuid not null references auth.users on delete cascade,
  item_id     text not null,
  box         int  not null default 1 check (box between 1 and 5),
  due_at      timestamptz not null,
  streak      int  not null default 0,
  last_result boolean,
  updated_at  timestamptz not null default now(),
  primary key (user_id, item_id)
);

-- session queue reads "my rows that are due"
create index if not exists review_state_user_due_idx
  on public.review_state (user_id, due_at);

-- ---------------------------------------------------------------------------
-- attempts: every answer, for analytics + mastery
-- ---------------------------------------------------------------------------
create table if not exists public.attempts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  item_id    text not null,
  correct    boolean not null,
  chosen     jsonb,
  ms_taken   int,
  created_at timestamptz not null default now()
);

create index if not exists attempts_user_created_idx
  on public.attempts (user_id, created_at desc);

-- the sync queue may retry a flush; make replays idempotent
create unique index if not exists attempts_user_item_created_uniq
  on public.attempts (user_id, item_id, created_at);

-- ---------------------------------------------------------------------------
-- Row Level Security — a user may only touch their own rows.
-- This is the ONLY boundary: Kira ships a publishable key in a public bundle.
-- ---------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.review_state enable row level security;
alter table public.attempts     enable row level security;

drop policy if exists "profiles are self-service" on public.profiles;
create policy "profiles are self-service" on public.profiles
  for all
  using      (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "review_state is self-service" on public.review_state;
create policy "review_state is self-service" on public.review_state
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "attempts are self-service" on public.attempts;
create policy "attempts are self-service" on public.attempts
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Create a profile automatically on sign-up (including anonymous sign-in).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
