-- ===========================================================================
-- LOCAL TEST FILE — NEVER RUN THIS IN THE SUPABASE SQL EDITOR.
-- It writes fixture rows into auth.users, and the harness it depends on
-- replaces auth.uid(). Against production that breaks every RLS policy in the
-- app. It is only ever run by ./supabase/tests/run.sh against a throwaway
-- local Postgres.
-- ===========================================================================
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'auth' and table_name = 'users'
      and column_name = 'encrypted_password'
  ) then
    raise exception
      'REFUSING TO RUN: this database has a real auth schema. This file is a LOCAL TEST fixture — see supabase/tests/run.sh.';
  end if;
end $$;

-- class_activity + class_item_stats tests (migration 0009).
--
-- Both are SECURITY DEFINER and owner-only, so the guard inside each IS the
-- boundary and the negative cases carry the weight. The positive cases are
-- about not lying: a practice STRIP that counts sessions instead of days would
-- make one long evening look like a week of steady work, which is the exact
-- claim the feature exists to check.
\set ON_ERROR_STOP on
\pset pager off

-- Pin the session zone so "midday on day N" means the same thing here as it
-- does inside class_activity when the tests pass 'UTC'. Anchoring fixtures to
-- midday rather than to now() also keeps them deterministic: a now()-offset
-- fixture silently changes which DAY it lands on when the suite happens to run
-- near midnight.
set timezone = 'UTC';

insert into auth.users (id, email) values
  ('d1111111-1111-1111-1111-111111111111', 'teacher@example.com'),
  ('d2222222-2222-2222-2222-222222222222', 'aina@example.com'),
  ('d3333333-3333-3333-3333-333333333333', 'zul@example.com'),
  ('d4444444-4444-4444-4444-444444444444', 'other-teacher@example.com'),
  ('d5555555-5555-5555-5555-555555555555', 'outsider@example.com');

-- Aina: practised on 3 distinct days, but TWICE on one of them. The strip must
-- report 3 days, not 4 attempts. (Note the timestamps also have to differ:
-- attempts carries a (user_id, item_id, created_at) unique index for sync
-- replay safety.)
insert into public.attempts (user_id, item_id, correct, created_at) values
  ('d2222222-2222-2222-2222-222222222222','ap-001', true,  date_trunc('day', now()) + interval '12 hour'),
  ('d2222222-2222-2222-2222-222222222222','ap-002', false, date_trunc('day', now()) + interval '12 hour' + interval '5 min'),
  ('d2222222-2222-2222-2222-222222222222','ap-003', true,  date_trunc('day', now()) + interval '12 hour' - interval '2 day'),
  ('d2222222-2222-2222-2222-222222222222','ap-004', false, date_trunc('day', now()) + interval '12 hour' - interval '5 day'),
  -- outside the window entirely
  ('d2222222-2222-2222-2222-222222222222','ap-005', true,  date_trunc('day', now()) + interval '12 hour' - interval '30 day');

-- Zul got the SAME item wrong as Aina — that is what makes it a class problem
-- rather than one learner's — and got ap-009 wrong twice, on two days.
insert into public.attempts (user_id, item_id, correct, created_at) values
  ('d3333333-3333-3333-3333-333333333333','ap-002', false, date_trunc('day', now()) + interval '12 hour' - interval '1 day'),
  ('d3333333-3333-3333-3333-333333333333','ap-009', false, date_trunc('day', now()) + interval '12 hour' - interval '1 day' + interval '5 min'),
  ('d3333333-3333-3333-3333-333333333333','ap-009', false, date_trunc('day', now()) + interval '12 hour' - interval '3 day');

-- The outsider is in nobody's class and must never be counted.
insert into public.attempts (user_id, item_id, correct, created_at) values
  ('d5555555-5555-5555-5555-555555555555','ap-002', false, date_trunc('day', now()) + interval '12 hour'),
  ('d5555555-5555-5555-5555-555555555555','SECRET-ITEM', false, date_trunc('day', now()) + interval '12 hour' + interval '5 min');

grant select, insert, update, delete on all tables in schema public to authenticated, anon;

\echo ''
\echo '=============== CLASS INSIGHT TESTS ==============='
set role authenticated;

set request.jwt.claim.sub = 'd1111111-1111-1111-1111-111111111111';
select join_code from public.create_class('Form 4 Akaun') \gset c_
set request.jwt.claim.sub = 'd2222222-2222-2222-2222-222222222222';
select public.join_class(:'c_join_code') is not null as joined_aina;
set request.jwt.claim.sub = 'd3333333-3333-3333-3333-333333333333';
select public.join_class(:'c_join_code') is not null as joined_zul;

set request.jwt.claim.sub = 'd4444444-4444-4444-4444-444444444444';
select join_code from public.create_class('Someone Else') \gset o_

\echo ''
\echo '--- 1. the strip is exactly 7 days, one row per member ---'
set request.jwt.claim.sub = 'd1111111-1111-1111-1111-111111111111';
select count(*) = 2 as one_row_per_member
from public.class_activity(
  (select id from public.classes where join_code = :'c_join_code'), 'UTC');

select bool_and(array_length(days, 1) = 7) as always_seven_days
from public.class_activity(
  (select id from public.classes where join_code = :'c_join_code'), 'UTC');

\echo ''
\echo '--- 2. it counts DAYS, not attempts ---'
-- Aina answered 4 items inside the window across 3 days. A strip that counted
-- sessions would make one long evening look like a week of steady work.
select (select count(*) from unnest(days) d where d) = 3 as three_distinct_days
from public.class_activity(
  (select id from public.classes where join_code = :'c_join_code'), 'UTC')
where user_id = 'd2222222-2222-2222-2222-222222222222';

\echo ''
\echo '--- 3. today is the LAST entry, and it is true for someone who practised ---'
select days[7] as today_is_last
from public.class_activity(
  (select id from public.classes where join_code = :'c_join_code'), 'UTC')
where user_id = 'd2222222-2222-2222-2222-222222222222';

\echo ''
\echo '--- 4. an attempt older than the window is not reported ---'
-- Aina's 30-day-old row must not light a dot: she practised on 3 days inside
-- the window, not 4. Zul is the control — two days, both inside.
select (select count(*) from unnest(days) d where d) = 2 as zul_two_days
from public.class_activity(
  (select id from public.classes where join_code = :'c_join_code'), 'UTC')
where user_id = 'd3333333-3333-3333-3333-333333333333';

\echo ''
\echo '--- 5. a nonsense timezone falls back to UTC instead of raising ---'
-- A progress report must not fail to load because a device reported an odd
-- locale string.
select count(*) = 2 as bogus_tz_survived
from public.class_activity(
  (select id from public.classes where join_code = :'c_join_code'),
  'Not/AZone');

\echo ''
\echo '--- 6. class_item_stats separates "one learner six times" from "six learners once" ---'
-- ap-002: wrong once by Aina and once by Zul  -> 2 learners.
-- ap-009: wrong twice by Zul alone            -> 1 learner.
-- That difference is a reteach vs a conversation, and the totals alone cannot
-- tell them apart.
select wrong = 2 as ap002_wrong_twice, learners = 2 as ap002_two_learners
from public.class_item_stats(
  (select id from public.classes where join_code = :'c_join_code'))
where item_id = 'ap-002';

select wrong = 2 as ap009_wrong_twice, learners = 1 as ap009_one_learner
from public.class_item_stats(
  (select id from public.classes where join_code = :'c_join_code'))
where item_id = 'ap-009';

\echo ''
\echo '--- 7. a correct answer counts as an attempt but never as wrong ---'
select attempts = 1 as counted, wrong = 0 as not_wrong
from public.class_item_stats(
  (select id from public.classes where join_code = :'c_join_code'))
where item_id = 'ap-001';

\echo ''
\echo '--- 8. an outsider''s attempts never reach the class figures ---'
select not exists (
  select 1 from public.class_item_stats(
    (select id from public.classes where join_code = :'c_join_code'))
  where item_id = 'SECRET-ITEM'
) as outsider_excluded;
-- and their wrong answer on a SHARED item did not inflate the learner count
select learners = 2 as outsider_not_counted
from public.class_item_stats(
  (select id from public.classes where join_code = :'c_join_code'))
where item_id = 'ap-002';

\echo ''
\echo '--- 9. a MEMBER cannot read either function ---'
-- These cover the whole class, so unlike learner_item_stats there is no
-- "about myself" reading of them that would be harmless.
set request.jwt.claim.sub = 'd2222222-2222-2222-2222-222222222222';
do $$
begin
  perform * from public.class_activity(
    (select id from public.classes where name = 'Form 4 Akaun'), 'UTC');
  raise notice 'FAIL_member_read_activity';
exception when sqlstate '42501' then
  raise notice 'blocked_member_activity';
end $$;
do $$
begin
  perform * from public.class_item_stats(
    (select id from public.classes where name = 'Form 4 Akaun'));
  raise notice 'FAIL_member_read_item_stats';
exception when sqlstate '42501' then
  raise notice 'blocked_member_item_stats';
end $$;

\echo ''
\echo '--- 10. owning SOME class does not grant reading another one ---'
set request.jwt.claim.sub = 'd4444444-4444-4444-4444-444444444444';
do $$
begin
  perform * from public.class_activity(
    (select id from public.classes where name = 'Form 4 Akaun'), 'UTC');
  raise notice 'FAIL_other_teacher_activity';
exception when sqlstate '42501' then
  raise notice 'blocked_other_teacher_activity';
end $$;
do $$
begin
  perform * from public.class_item_stats(
    (select id from public.classes where name = 'Form 4 Akaun'));
  raise notice 'FAIL_other_teacher_item_stats';
exception when sqlstate '42501' then
  raise notice 'blocked_other_teacher_item_stats';
end $$;

\echo ''
\echo '--- 11. a caller with no identity is refused ---'
set role anon;
set request.jwt.claim.sub = '';
do $$
begin
  perform * from public.class_item_stats(
    (select id from public.classes where name = 'Form 4 Akaun'));
  raise notice 'FAIL_anon_read';
exception when others then
  raise notice 'blocked_anon';
end $$;

\echo ''
\echo '--- 12. neither function is executable by PUBLIC ---'
set role authenticated;
select has_function_privilege('authenticated', 'public.class_activity(uuid,text)', 'execute') as act_authenticated,
       has_function_privilege('anon',          'public.class_activity(uuid,text)', 'execute') as act_anon,
       has_function_privilege('authenticated', 'public.class_item_stats(uuid)', 'execute') as stats_authenticated,
       has_function_privilege('anon',          'public.class_item_stats(uuid)', 'execute') as stats_anon;

\echo ''
\echo '--- 13. an empty class yields no rows rather than an error ---'
set request.jwt.claim.sub = 'd4444444-4444-4444-4444-444444444444';
select count(*) = 0 as empty_class_activity
from public.class_activity(
  (select id from public.classes where join_code = :'o_join_code'), 'UTC');
select count(*) = 0 as empty_class_stats
from public.class_item_stats(
  (select id from public.classes where join_code = :'o_join_code'));
