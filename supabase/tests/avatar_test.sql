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

-- Avatar tests (migration 0006).
--
-- The CHECK constraint is the boundary that matters: profiles has a
-- self-service RLS policy from 0001, so a learner can UPDATE their own row
-- directly and bypass set_avatar() entirely. Anything they can store ends up
-- rendered on their classmates' leaderboard and their teacher's roster, so the
-- tests push hardest on writing junk by the direct path.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('c1111111-1111-1111-1111-111111111111', 'teacher@example.com'),
  ('c2222222-2222-2222-2222-222222222222', 'aina@example.com'),
  ('c3333333-3333-3333-3333-333333333333', 'zul@example.com');

update public.profiles set display_name = 'Aina' where id = 'c2222222-2222-2222-2222-222222222222';
update public.profiles set display_name = 'Zul'  where id = 'c3333333-3333-3333-3333-333333333333';

insert into public.attempts (user_id, item_id, correct, created_at) values
  ('c2222222-2222-2222-2222-222222222222','ap-001', true, now() - interval '1 day');
insert into public.review_state (user_id, item_id, box, due_at, updated_at) values
  ('c2222222-2222-2222-2222-222222222222','ap-001', 5, now() + interval '5 day', now() - interval '1 day');

grant select, insert, update, delete on all tables in schema public to authenticated, anon;

\echo ''
\echo '=============== AVATAR TESTS ==============='
set role authenticated;

set request.jwt.claim.sub = 'c1111111-1111-1111-1111-111111111111';
select join_code from public.create_class('Avatar class') \gset c_
set request.jwt.claim.sub = 'c2222222-2222-2222-2222-222222222222';
select public.join_class(:'c_join_code') is not null as joined_aina;
set request.jwt.claim.sub = 'c3333333-3333-3333-3333-333333333333';
select public.join_class(:'c_join_code') is not null as joined_zul;

\echo ''
\echo '--- 1. a learner can set an allowed face ---'
set request.jwt.claim.sub = 'c2222222-2222-2222-2222-222222222222';
select public.set_avatar('🦊') = '🦊' as set_ok;
select avatar = '🦊' as stored_ok from public.profiles where id = 'c2222222-2222-2222-2222-222222222222';

\echo ''
\echo '--- 2. null clears it, falling back to the derived face ---'
select public.set_avatar(null) is null as cleared;
select avatar is null as stored_null from public.profiles where id = 'c2222222-2222-2222-2222-222222222222';
select public.set_avatar('🦊') is not null as set_again;

\echo ''
\echo '--- 3. a face that is not on the list is REJECTED via the RPC ---'
do $$
begin
  perform public.set_avatar('💩');
  raise notice 'FAIL_rpc_allowed_unlisted_emoji';
exception when check_violation then
  raise notice 'ok rpc rejected unlisted';
end $$;

\echo ''
\echo '--- 4. THE KEY GUARD: arbitrary text cannot be written by the DIRECT'
\echo '       path either, which bypasses the RPC entirely ---'
do $$
begin
  update public.profiles set avatar = 'BUY CHEAP PILLS'
    where id = 'c2222222-2222-2222-2222-222222222222';
  raise notice 'FAIL_direct_update_stored_junk';
exception when check_violation then
  raise notice 'ok direct update rejected';
end $$;
select avatar = '🦊' as unchanged_after_attack
from public.profiles where id = 'c2222222-2222-2222-2222-222222222222';

\echo ''
\echo '--- 5. a learner still cannot set someone ELSE''s avatar (0001 RLS) ---'
update public.profiles set avatar = '🐼' where id = 'c3333333-3333-3333-3333-333333333333';
select avatar is null as zul_untouched
from public.profiles where id = 'c3333333-3333-3333-3333-333333333333';

\echo ''
\echo '--- 6. the leaderboard carries the face to classmates ---'
select avatar = '🦊' as leaderboard_has_avatar
from public.class_leaderboard(
  (select id from public.classes where join_code = :'c_join_code'),
  now() - interval '7 days')
where display_name = 'Aina';

\echo ''
\echo '--- 7. the roster carries it to the teacher, aggregates intact ---'
set request.jwt.claim.sub = 'c1111111-1111-1111-1111-111111111111';
select
  avatar = '🦊' as roster_has_avatar,
  seen = 1      as seen_still_right,
  mastered = 1  as mastered_still_right,
  attempts = 1  as attempts_still_right
from public.class_roster((select id from public.classes where join_code = :'c_join_code'))
where user_id = 'c2222222-2222-2222-2222-222222222222';

\echo ''
\echo '--- 8. a learner with no chosen face reports null, not a blank string ---'
select avatar is null as null_not_empty
from public.class_roster((select id from public.classes where join_code = :'c_join_code'))
where user_id = 'c3333333-3333-3333-3333-333333333333';

\echo ''
\echo '--- 9. the roster is still owner-only after being recreated ---'
set request.jwt.claim.sub = 'c2222222-2222-2222-2222-222222222222';
do $$
begin
  perform * from public.class_roster((select id from public.classes where name = 'Avatar class'));
  raise notice 'FAIL_member_read_roster';
exception when insufficient_privilege then
  raise notice 'ok member still blocked';
end $$;
