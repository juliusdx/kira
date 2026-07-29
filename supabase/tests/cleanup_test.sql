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
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    raise exception
      'REFUSING TO RUN: this is a real Supabase database. This file is a LOCAL TEST fixture — see supabase/tests/run.sh.';
  end if;
end $$;

-- Probe-cleanup tests (supabase/maintenance/cleanup_probe_users.sql, STEP 0).
--
-- That script is a DELETE run by hand against production, matching on a
-- footprint rather than on ids. It is the most dangerous thing in the repo, so
-- the guards get tested the same way a migration's do: build a population of
-- users who each trip exactly one guard, run the real predicate, and assert
-- that only the litter goes.
\set ON_ERROR_STOP on
\pset pager off

-- u1  probe: nothing to its name                          -> DELETE
-- u2  probe from the same burst                           -> DELETE
-- u3  real learner, has attempts                          -> keep
-- u4  real learner, has review_state only                 -> keep
-- u5  learner in a class, otherwise empty                 -> keep
-- u6  teacher who owns a class, otherwise empty           -> keep
-- u7  empty but named themselves                          -> keep
-- u8  empty but picked an avatar                          -> keep
-- u9  empty but has a push subscription                   -> keep
-- u10 has an email (a real account)                       -> keep
insert into auth.users (id, email, created_at) values
  ('a0000001-0000-0000-0000-000000000000', null, now()),
  ('a0000002-0000-0000-0000-000000000000', null, now()),
  ('a0000003-0000-0000-0000-000000000000', null, now() - interval '30 day'),
  ('a0000004-0000-0000-0000-000000000000', null, now() - interval '30 day'),
  ('a0000005-0000-0000-0000-000000000000', null, now() - interval '30 day'),
  ('a0000006-0000-0000-0000-000000000000', null, now() - interval '30 day'),
  ('a0000007-0000-0000-0000-000000000000', null, now() - interval '30 day'),
  ('a0000008-0000-0000-0000-000000000000', null, now() - interval '30 day'),
  ('a0000009-0000-0000-0000-000000000000', null, now() - interval '30 day'),
  ('a0000010-0000-0000-0000-000000000000', 'real@example.com', now() - interval '30 day');

insert into public.attempts (user_id, item_id, correct, created_at) values
  ('a0000003-0000-0000-0000-000000000000', 'ta-008', false, now());
insert into public.review_state (user_id, item_id, box, due_at, updated_at) values
  ('a0000004-0000-0000-0000-000000000000', 'ta-008', 2, now(), now());
update public.profiles set display_name = 'Ariel' where id = 'a0000007-0000-0000-0000-000000000000';
update public.profiles set avatar = '🦊'       where id = 'a0000008-0000-0000-0000-000000000000';
insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, timezone, send_hour)
  values ('a0000009-0000-0000-0000-000000000000', 'https://example.test/x', 'k', 'a', 'Asia/Kuala_Lumpur', 19);

grant select, insert, update, delete on all tables in schema public to authenticated, anon;

\echo ''
\echo '=============== PROBE CLEANUP TESTS ==============='
set role authenticated;
-- u6 owns a class; u5 joins it
set request.jwt.claim.sub = 'a0000006-0000-0000-0000-000000000000';
select join_code from public.create_class('Real class') \gset r_
set request.jwt.claim.sub = 'a0000005-0000-0000-0000-000000000000';
select public.join_class(:'r_join_code') is not null as joined;
reset role;

\echo ''
\echo '--- 1. the report lists exactly the two probes ---'
select count(*) = 2 as report_count,
       bool_and(u.id in ('a0000001-0000-0000-0000-000000000000',
                         'a0000002-0000-0000-0000-000000000000')) as report_only_probes
from auth.users u
left join public.profiles p on p.id = u.id
where u.email is null
  and not exists (select 1 from public.review_state       r where r.user_id  = u.id)
  and not exists (select 1 from public.attempts           a where a.user_id  = u.id)
  and not exists (select 1 from public.class_members      m where m.user_id  = u.id)
  and not exists (select 1 from public.classes            c where c.owner_id = u.id)
  and not exists (select 1 from public.push_subscriptions s where s.user_id  = u.id)
  and coalesce(p.display_name, '') = ''
  and p.avatar is null;

\echo ''
\echo '--- 2. the delete removes the probes and nothing else ---'
-- The predicate below must stay character-for-character the same as the one in
-- cleanup_probe_users.sql STEP 0. If you edit one, edit both.
with gone as (
  delete from auth.users u
  where u.email is null
    and not exists (select 1 from public.review_state       r where r.user_id  = u.id)
    and not exists (select 1 from public.attempts           a where a.user_id  = u.id)
    and not exists (select 1 from public.class_members      m where m.user_id  = u.id)
    and not exists (select 1 from public.classes            c where c.owner_id = u.id)
    and not exists (select 1 from public.push_subscriptions s where s.user_id  = u.id)
    and not exists (select 1 from public.profiles pr
                    where pr.id = u.id
                      and (coalesce(pr.display_name, '') <> '' or pr.avatar is not null))
    and u.id <> 'bb520b30-733d-4250-8f5e-8668e2af9df0'
  returning u.id
)
select count(*) = 2 as deleted_two from gone;

\echo ''
\echo '--- 3. every user who had ANYTHING survived ---'
select
  (select count(*) from auth.users where id = 'a0000003-0000-0000-0000-000000000000') = 1 as kept_attempts,
  (select count(*) from auth.users where id = 'a0000004-0000-0000-0000-000000000000') = 1 as kept_reviews,
  (select count(*) from auth.users where id = 'a0000005-0000-0000-0000-000000000000') = 1 as kept_member,
  (select count(*) from auth.users where id = 'a0000006-0000-0000-0000-000000000000') = 1 as kept_owner,
  (select count(*) from auth.users where id = 'a0000007-0000-0000-0000-000000000000') = 1 as kept_named,
  (select count(*) from auth.users where id = 'a0000008-0000-0000-0000-000000000000') = 1 as kept_avatar,
  (select count(*) from auth.users where id = 'a0000009-0000-0000-0000-000000000000') = 1 as kept_push,
  (select count(*) from auth.users where id = 'a0000010-0000-0000-0000-000000000000') = 1 as kept_email;

\echo ''
\echo '--- 4. the probes are really gone, cascade and all ---'
select
  (select count(*) from auth.users      where id      in ('a0000001-0000-0000-0000-000000000000','a0000002-0000-0000-0000-000000000000')) = 0 as users_gone,
  (select count(*) from public.profiles where id      in ('a0000001-0000-0000-0000-000000000000','a0000002-0000-0000-0000-000000000000')) = 0 as profiles_gone;

\echo ''
\echo '--- 5. re-running it is a no-op, not a second bite ---'
with gone as (
  delete from auth.users u
  where u.email is null
    and not exists (select 1 from public.review_state       r where r.user_id  = u.id)
    and not exists (select 1 from public.attempts           a where a.user_id  = u.id)
    and not exists (select 1 from public.class_members      m where m.user_id  = u.id)
    and not exists (select 1 from public.classes            c where c.owner_id = u.id)
    and not exists (select 1 from public.push_subscriptions s where s.user_id  = u.id)
    and not exists (select 1 from public.profiles pr
                    where pr.id = u.id
                      and (coalesce(pr.display_name, '') <> '' or pr.avatar is not null))
    and u.id <> 'bb520b30-733d-4250-8f5e-8668e2af9df0'
  returning u.id
)
select count(*) = 0 as second_run_is_noop from gone;

\echo ''
\echo '--- 6. Julius is excluded even with an empty footprint ---'
insert into auth.users (id, email) values ('bb520b30-733d-4250-8f5e-8668e2af9df0', null);
with gone as (
  delete from auth.users u
  where u.email is null
    and not exists (select 1 from public.review_state       r where r.user_id  = u.id)
    and not exists (select 1 from public.attempts           a where a.user_id  = u.id)
    and not exists (select 1 from public.class_members      m where m.user_id  = u.id)
    and not exists (select 1 from public.classes            c where c.owner_id = u.id)
    and not exists (select 1 from public.push_subscriptions s where s.user_id  = u.id)
    and not exists (select 1 from public.profiles pr
                    where pr.id = u.id
                      and (coalesce(pr.display_name, '') <> '' or pr.avatar is not null))
    and u.id <> 'bb520b30-733d-4250-8f5e-8668e2af9df0'
  returning u.id
)
select count(*) = 0 as julius_excluded from gone;
