-- Minimal Supabase-compatible shim so the real migrations can run unmodified
-- against a plain Postgres, and RLS can be exercised as actual roles.

create extension if not exists pgcrypto;

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text
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
