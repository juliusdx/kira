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

-- Roster roll-up tests (migration 0005).
--
-- class_roster / learner_item_stats are SECURITY DEFINER, so they bypass RLS
-- entirely and the guard inside each function IS the security boundary. These
-- tests therefore push hardest on the negative cases: a non-owner, a member
-- who is not the teacher, and a teacher of a DIFFERENT class trying to read a
-- learner who is not theirs.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('b1111111-1111-1111-1111-111111111111', 'teacher@example.com'),
  ('b2222222-2222-2222-2222-222222222222', 'aina@example.com'),
  ('b3333333-3333-3333-3333-333333333333', 'zul@example.com'),
  ('b4444444-4444-4444-4444-444444444444', 'other-teacher@example.com'),
  ('b5555555-5555-5555-5555-555555555555', 'stranger@example.com');

update public.profiles set display_name = 'Aina' where id = 'b2222222-2222-2222-2222-222222222222';
update public.profiles set display_name = '  '   where id = 'b3222222-2222-2222-2222-222222222222';

-- Aina: 3 items seen, one mastered (box 5), one due now, one due later.
insert into public.review_state (user_id, item_id, box, due_at, updated_at) values
  ('b2222222-2222-2222-2222-222222222222','ap-001', 5, now() + interval '10 day', now() - interval '1 day'),
  ('b2222222-2222-2222-2222-222222222222','ap-002', 2, now() - interval '1 hour', now() - interval '2 day'),
  ('b2222222-2222-2222-2222-222222222222','dp-001', 1, now() + interval '1 day', now() - interval '3 day');
-- 4 attempts, 3 correct; the two wrong-ish ones are on ap-002
insert into public.attempts (user_id, item_id, correct, created_at) values
  ('b2222222-2222-2222-2222-222222222222','ap-001', true,  now() - interval '1 day'),
  ('b2222222-2222-2222-2222-222222222222','ap-002', false, now() - interval '2 day'),
  ('b2222222-2222-2222-2222-222222222222','ap-002', true,  now() - interval '2 day 1 hour'),
  ('b2222222-2222-2222-2222-222222222222','dp-001', true,  now() - interval '3 day');

-- Zul joined but has done nothing at all.
-- The stranger is busy but belongs to no class — must never appear anywhere.
insert into public.attempts (user_id, item_id, correct, created_at) values
  ('b5555555-5555-5555-5555-555555555555','ap-001', true, now()),
  ('b5555555-5555-5555-5555-555555555555','ap-002', true, now());

grant select, insert, update, delete on all tables in schema public to authenticated, anon;

\echo ''
\echo '=============== ROSTER ROLL-UP TESTS ==============='
set role authenticated;

set request.jwt.claim.sub = 'b1111111-1111-1111-1111-111111111111';
select join_code from public.create_class('Form 4 Akaun') \gset c_
set request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';
select public.join_class(:'c_join_code') is not null as joined_aina;
set request.jwt.claim.sub = 'b3333333-3333-3333-3333-333333333333';
select public.join_class(:'c_join_code') is not null as joined_zul;

-- a second, unrelated class owned by someone else
set request.jwt.claim.sub = 'b4444444-4444-4444-4444-444444444444';
select join_code from public.create_class('Someone Else') \gset o_

\echo ''
\echo '--- 1. the owner sees every member, including the idle one ---'
set request.jwt.claim.sub = 'b1111111-1111-1111-1111-111111111111';
select count(*) = 2 as owner_sees_both
from public.class_roster((select id from public.classes where join_code = :'c_join_code'));

\echo ''
\echo '--- 2. aggregates are right ---'
select
  seen = 3      as seen_ok,
  mastered = 1  as mastered_ok,
  due = 1       as due_ok,
  attempts = 4  as attempts_ok,
  correct = 3   as correct_ok,
  box_counts = array[1,1,0,0,1]::bigint[] as boxes_ok,
  display_name = 'Aina' as name_ok,
  last_active_at is not null as active_ok
from public.class_roster((select id from public.classes where join_code = :'c_join_code'))
where user_id = 'b2222222-2222-2222-2222-222222222222';

\echo ''
\echo '--- 3. a member who never practised still appears, zeroed ---'
select
  seen = 0 as zero_seen,
  attempts = 0 as zero_attempts,
  box_counts = array[0,0,0,0,0]::bigint[] as zero_boxes,
  last_active_at is null as never_active
from public.class_roster((select id from public.classes where join_code = :'c_join_code'))
where user_id = 'b3333333-3333-3333-3333-333333333333';

\echo ''
\echo '--- 4. the busy stranger is in NO roster ---'
select not exists (
  select 1 from public.class_roster((select id from public.classes where join_code = :'c_join_code'))
  where user_id = 'b5555555-5555-5555-5555-555555555555'
) as stranger_absent;

\echo ''
\echo '--- 5. a MEMBER cannot read the roster (only the owner) ---'
set request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';
do $$
begin
  perform * from public.class_roster((select id from public.classes where name = 'Form 4 Akaun'));
  raise notice 'FAIL_member_read_roster';
exception when insufficient_privilege then
  raise notice 'ok member blocked';
end $$;
select not exists (
  select 1 from public.class_members cm
  join public.classes c on c.id = cm.class_id
  where c.name = 'Form 4 Akaun' and c.owner_id = 'b2222222-2222-2222-2222-222222222222'
) as member_is_not_owner;

\echo ''
\echo '--- 6. another teacher cannot read this roster ---'
set request.jwt.claim.sub = 'b4444444-4444-4444-4444-444444444444';
do $$
begin
  perform * from public.class_roster((select id from public.classes where name = 'Form 4 Akaun'));
  raise notice 'FAIL_other_teacher_read_roster';
exception when insufficient_privilege then
  raise notice 'ok other teacher blocked';
end $$;

\echo ''
\echo '--- 7. learner_item_stats: the owner gets per-item history ---'
set request.jwt.claim.sub = 'b1111111-1111-1111-1111-111111111111';
select count(*) = 3 as three_items
from public.learner_item_stats(
  (select id from public.classes where join_code = :'c_join_code'),
  'b2222222-2222-2222-2222-222222222222');

select
  box = 2       as box_ok,
  attempts = 2  as attempts_ok,
  wrong = 1     as wrong_ok,
  last_wrong_at is not null as wrong_stamped
from public.learner_item_stats(
  (select id from public.classes where join_code = :'c_join_code'),
  'b2222222-2222-2222-2222-222222222222')
where item_id = 'ap-002';

\echo ''
\echo '--- 8. an item answered but with no review row is still reported ---'
-- reset (not "set role postgres" — the local superuser is named after the OS
-- user) so the fixture insert is not itself subject to RLS
reset role;
insert into public.attempts (user_id, item_id, correct, created_at) values
  ('b2222222-2222-2222-2222-222222222222','orphan-01', false, now());
set role authenticated;
set request.jwt.claim.sub = 'b1111111-1111-1111-1111-111111111111';
select box is null and attempts = 1 and wrong = 1 as orphan_reported
from public.learner_item_stats(
  (select id from public.classes where join_code = :'c_join_code'),
  'b2222222-2222-2222-2222-222222222222')
where item_id = 'orphan-01';

\echo ''
\echo '--- 9. THE KEY GUARD: owning a class does not grant reading a'
\echo '       learner who is not in it ---'
set request.jwt.claim.sub = 'b4444444-4444-4444-4444-444444444444';
do $$
begin
  -- this teacher owns "Someone Else"; Aina is not in it
  perform * from public.learner_item_stats(
    (select id from public.classes where name = 'Someone Else'),
    'b2222222-2222-2222-2222-222222222222');
  raise notice 'FAIL_cross_class_learner_read';
exception when insufficient_privilege then
  raise notice 'ok cross-class read blocked';
end $$;

\echo ''
\echo '--- 10. and cannot borrow another teacher''s class id either ---'
do $$
begin
  perform * from public.learner_item_stats(
    (select id from public.classes where name = 'Form 4 Akaun'),
    'b2222222-2222-2222-2222-222222222222');
  raise notice 'FAIL_borrowed_class_id_read';
exception when insufficient_privilege then
  raise notice 'ok borrowed class id blocked';
end $$;

\echo ''
\echo '--- 11. an anonymous caller with no uid is refused ---'
set role anon;
set request.jwt.claim.sub = '';
do $$
begin
  perform * from public.class_roster((select id from public.classes where name = 'Form 4 Akaun'));
  raise notice 'FAIL_anon_read_roster';
exception when insufficient_privilege then
  raise notice 'ok anon blocked';
end $$;
