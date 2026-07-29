-- ===========================================================================
-- LOCAL TEST FILE — NEVER RUN THIS IN THE SUPABASE SQL EDITOR.
-- It writes fixture rows into auth.users, and the harness it depends on
-- replaces auth.uid(). Against production that breaks every RLS policy in the
-- app. It is only ever run by ./supabase/tests/run.sh against a throwaway
-- local Postgres.
--
-- The guard below is a hard stop, not a comment: `supabase_auth_admin` exists
-- only on a real Supabase database.
-- ===========================================================================
do $$
begin
  -- Per-DATABASE, deliberately: a role check would be cluster-wide, so one
  -- stray `create role supabase_auth_admin` anywhere on the machine would
  -- refuse every local test run. Only a real GoTrue auth.users has
  -- encrypted_password; the harness's fake one never will.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users'
      and column_name = 'encrypted_password'
  ) then
    raise exception
      'REFUSING TO RUN: this database has a real auth schema. This file is a LOCAL TEST fixture — see supabase/tests/run.sh.';
  end if;
end $$;

-- Minimal Supabase-compatible shim so the real migrations can run unmodified
-- against a plain Postgres, and RLS can be exercised as actual roles.

create extension if not exists pgcrypto;

create schema if not exists auth;

-- Only the columns the migrations and maintenance scripts actually touch.
-- created_at / last_sign_in_at are here because the probe-cleanup script reads
-- them, and a destructive script has to be testable.
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  created_at timestamptz not null default now(),
  last_sign_in_at timestamptz
);

-- Supabase exposes the caller's uid from the request JWT. Here we emulate it
-- with a session GUC that each test sets before acting "as" a user.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

-- Roles PostgREST uses. RLS does NOT apply to superusers or table owners, so
-- tests must run as a non-owning role with BYPASSRLS off.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant usage on schema auth   to anon, authenticated;
grant select on auth.users   to anon, authenticated;
