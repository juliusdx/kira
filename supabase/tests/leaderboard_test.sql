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

-- Leaderboard tests. The whole point of doing this as a SECURITY DEFINER
-- function is that classmates gain visibility of RANKS without gaining
-- visibility of each other's ANSWERS. Both halves are asserted here.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('a1111111-1111-1111-1111-111111111111', 't@example.com'),
  ('a2222222-2222-2222-2222-222222222222', 'aina@example.com'),
  ('a3333333-3333-3333-3333-333333333333', 'zul@example.com'),
  ('a4444444-4444-4444-4444-444444444444', 'outsider@example.com');

update public.profiles set display_name = 'Aina' where id = 'a2222222-2222-2222-2222-222222222222';
update public.profiles set display_name = 'Zul'  where id = 'a3333333-3333-3333-3333-333333333333';

-- Aina practised 3 distinct items (one of them twice — must count ONCE)
insert into public.attempts (user_id, item_id, correct, created_at) values
  -- same item twice, distinct timestamps (the unique index is replay safety)
  ('a2222222-2222-2222-2222-222222222222','ap-001', true,  now() - interval '1 day'),
  ('a2222222-2222-2222-2222-222222222222','ap-001', false, now() - interval '1 day 1 hour'),
  ('a2222222-2222-2222-2222-222222222222','ap-002', true,  now() - interval '2 day'),
  ('a2222222-2222-2222-2222-222222222222','dp-001', true,  now() - interval '3 day');
-- Zul practised 1 recent item, plus an OLD one outside the window
insert into public.attempts (user_id, item_id, correct, created_at) values
  ('a3333333-3333-3333-3333-333333333333','bd-001', true, now() - interval '1 day'),
  ('a3333333-3333-3333-3333-333333333333','bd-101', true, now() - interval '40 day');
-- the outsider is busy but belongs to no class
insert into public.attempts (user_id, item_id, correct, created_at) values
  ('a4444444-4444-4444-4444-444444444444','ap-001', true, now() - interval '1 day'),
  ('a4444444-4444-4444-4444-444444444444','ap-002', true, now() - interval '1 day'),
  ('a4444444-4444-4444-4444-444444444444','dp-001', true, now() - interval '1 day');

grant select, insert, update, delete on all tables in schema public to authenticated, anon;

\echo ''
\echo '=============== LEADERBOARD TESTS ==============='
set role authenticated;

set request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
select join_code from public.create_class('Class A') \gset c_
set request.jwt.claim.sub = 'a2222222-2222-2222-2222-222222222222';
select public.join_class(:'c_join_code') is not null as joined_aina;
set request.jwt.claim.sub = 'a3333333-3333-3333-3333-333333333333';
select public.join_class(:'c_join_code') is not null as joined_zul;

\echo ''
\echo '--- 1. a MEMBER can read the leaderboard ---'
set request.jwt.claim.sub = 'a2222222-2222-2222-2222-222222222222';
select display_name, score
from public.class_leaderboard(
  (select id from public.classes where join_code = :'c_join_code'),
  now() - interval '7 days'
);

\echo ''
\echo '--- 2. scores: distinct items in window; repeats count once ---'
select
  (select score from public.class_leaderboard(
     (select id from public.classes where join_code = :'c_join_code'),
     now() - interval '7 days') where display_name='Aina') = 3
    as "PASS_aina_3_distinct_not_4_attempts",
  (select score from public.class_leaderboard(
     (select id from public.classes where join_code = :'c_join_code'),
     now() - interval '7 days') where display_name='Zul') = 1
    as "PASS_zul_1_old_attempt_excluded";

\echo ''
\echo '--- 3. the outsider never appears, despite being the busiest ---'
select count(*) = 0 as "PASS_outsider_absent"
from public.class_leaderboard(
  (select id from public.classes where join_code = :'c_join_code'),
  now() - interval '7 days')
where display_name not in ('Aina','Zul','Learner');

\echo ''
\echo '--- 4. *** a member still CANNOT read a classmate raw answers *** ---'
select count(*) = 0 as "PASS_peer_attempts_still_hidden"
  from public.attempts where user_id = 'a3333333-3333-3333-3333-333333333333';
select count(*) = 0 as "PASS_peer_review_state_still_hidden"
  from public.review_state where user_id = 'a3333333-3333-3333-3333-333333333333';

\echo ''
\echo '--- 5. a NON-member cannot read the leaderboard at all ---'
set request.jwt.claim.sub = 'a4444444-4444-4444-4444-444444444444';
do $$
begin
  perform public.class_leaderboard(
    (select id from public.classes limit 1), now() - interval '7 days');
  raise notice 'FAIL_nonmember_read_leaderboard';
exception when others then
  raise notice 'PASS_nonmember_blocked (%)', sqlstate;
end $$;

\echo ''
\echo '--- 6. the teacher can read it too ---'
set request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
select count(*) = 2 as "PASS_teacher_sees_both_members"
from public.class_leaderboard(
  (select id from public.classes where join_code = :'c_join_code'),
  now() - interval '7 days');

\echo ''
\echo '--- 7. a member who never practised still appears, with 0 ---'
reset role; -- fixture setup needs owner rights
insert into auth.users (id) values ('a5555555-5555-5555-5555-555555555555');
set role authenticated;
set request.jwt.claim.sub = 'a5555555-5555-5555-5555-555555555555';
select public.join_class(:'c_join_code') is not null as joined_idle;
set request.jwt.claim.sub = 'a1111111-1111-1111-1111-111111111111';
select count(*) = 3 as "PASS_idle_member_listed"
from public.class_leaderboard(
  (select id from public.classes where join_code = :'c_join_code'),
  now() - interval '7 days');
select score = 0 as "PASS_idle_member_scores_zero"
from public.class_leaderboard(
  (select id from public.classes where join_code = :'c_join_code'),
  now() - interval '7 days')
where user_id = 'a5555555-5555-5555-5555-555555555555';

\echo ''
\echo '--- 8. set_display_name only ever touches your own row ---'
set request.jwt.claim.sub = 'a2222222-2222-2222-2222-222222222222';
select public.set_display_name('  Aina Binti  ') = 'Aina Binti' as "PASS_name_trimmed";
select display_name = 'Aina Binti' as "PASS_own_name_changed"
  from public.profiles where id = 'a2222222-2222-2222-2222-222222222222';
select display_name = 'Zul' as "PASS_peer_name_untouched"
  from public.profiles where id = 'a3333333-3333-3333-3333-333333333333';

reset role;
\echo ''
\echo '=============== END ==============='
