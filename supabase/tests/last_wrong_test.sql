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

-- learner_last_wrong tests (migration 0007).
--
-- This function returns what a learner actually TYPED, which makes it the most
-- sensitive thing a teacher can read. It is SECURITY DEFINER, so RLS is not
-- involved at all and the guard inside the function is the entire boundary.
-- The negative cases below are therefore the point of this file: a stranger, a
-- member who is not the teacher, a teacher of a DIFFERENT class, and — the one
-- that actually caught a bug class in 0005 — a real teacher of a real class
-- asking about a learner who is not in it.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('b1111111-1111-1111-1111-111111111111', 'teacher@example.com'),
  ('b2222222-2222-2222-2222-222222222222', 'aina@example.com'),
  ('b3333333-3333-3333-3333-333333333333', 'zul@example.com'),
  ('b4444444-4444-4444-4444-444444444444', 'other-teacher@example.com'),
  ('b5555555-5555-5555-5555-555555555555', 'stranger@example.com');

-- Aina got ta-008 wrong twice — the second time is the one that matters.
insert into public.attempts (user_id, item_id, correct, chosen, created_at) values
  ('b2222222-2222-2222-2222-222222222222','ta-008', false,
   '{"sides":{"0":"debit","1":"debit","2":"credit"},"balance":500}'::jsonb,
   now() - interval '3 day'),
  ('b2222222-2222-2222-2222-222222222222','ta-008', false,
   '{"sides":{"0":"debit","1":"credit","2":"credit"},"balance":1500}'::jsonb,
   now() - interval '1 day'),
  -- got it right in between; a correct answer must never be reported as a miss
  ('b2222222-2222-2222-2222-222222222222','dc-006', true,  '"Credit"'::jsonb, now()),
  -- a wrong answer with no chosen payload at all (pre-sync rows exist)
  ('b2222222-2222-2222-2222-222222222222','ap-001', false, null, now() - interval '2 day');

-- Zul is in the class but has never got anything wrong.
insert into public.attempts (user_id, item_id, correct, chosen, created_at) values
  ('b3333333-3333-3333-3333-333333333333','ap-001', true, '"Asset"'::jsonb, now());

-- The stranger belongs to no class. Their answers must be unreachable.
insert into public.attempts (user_id, item_id, correct, chosen, created_at) values
  ('b5555555-5555-5555-5555-555555555555','ta-008', false, '"SECRET"'::jsonb, now());

grant select, insert, update, delete on all tables in schema public to authenticated, anon;

\echo ''
\echo '=============== LAST WRONG ANSWER TESTS ==============='
set role authenticated;

set request.jwt.claim.sub = 'b1111111-1111-1111-1111-111111111111';
select join_code from public.create_class('Form 4 Akaun') \gset c_
set request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';
select public.join_class(:'c_join_code') is not null as joined_aina;
set request.jwt.claim.sub = 'b3333333-3333-3333-3333-333333333333';
select public.join_class(:'c_join_code') is not null as joined_zul;

-- a second, unrelated class owned by someone else, with its own member
set request.jwt.claim.sub = 'b4444444-4444-4444-4444-444444444444';
select join_code from public.create_class('Someone Else') \gset o_
set request.jwt.claim.sub = 'b5555555-5555-5555-5555-555555555555';
select public.join_class(:'o_join_code') is not null as joined_stranger;

\echo ''
\echo '--- 1. the owner gets one row per wrongly-answered item ---'
set request.jwt.claim.sub = 'b1111111-1111-1111-1111-111111111111';
select count(*) = 2 as one_row_per_wrong_item
from public.learner_last_wrong(
  (select id from public.classes where join_code = :'c_join_code'),
  'b2222222-2222-2222-2222-222222222222');

\echo ''
\echo '--- 2. it is the LATEST wrong answer, not the first ---'
select
  (chosen->>'balance') = '1500'            as latest_balance,
  (chosen->'sides'->>'1') = 'credit'       as latest_sides,
  wrong_at > now() - interval '2 day'      as latest_timestamp
from public.learner_last_wrong(
  (select id from public.classes where join_code = :'c_join_code'),
  'b2222222-2222-2222-2222-222222222222')
where item_id = 'ta-008';

\echo ''
\echo '--- 3. a correctly-answered item never appears ---'
select not exists (
  select 1 from public.learner_last_wrong(
    (select id from public.classes where join_code = :'c_join_code'),
    'b2222222-2222-2222-2222-222222222222')
  where item_id = 'dc-006'
) as correct_item_absent;

\echo ''
\echo '--- 4. a wrong attempt with no chosen payload is still reported ---'
-- Rows written before the client synced `chosen` exist. Dropping them would
-- silently shorten the teacher''s list with no indication why.
select count(*) = 1 as null_chosen_still_listed
from public.learner_last_wrong(
  (select id from public.classes where join_code = :'c_join_code'),
  'b2222222-2222-2222-2222-222222222222')
where item_id = 'ap-001' and chosen is null;

\echo ''
\echo '--- 5. a learner with nothing wrong yields nothing (not an error) ---'
select count(*) = 0 as spotless_learner_empty
from public.learner_last_wrong(
  (select id from public.classes where join_code = :'c_join_code'),
  'b3333333-3333-3333-3333-333333333333');

\echo ''
\echo '--- 6. a member of the class cannot read a classmate ---'
set request.jwt.claim.sub = 'b3333333-3333-3333-3333-333333333333';
do $$
begin
  perform * from public.learner_last_wrong(
    (select id from public.classes where name = 'Form 4 Akaun'),
    'b2222222-2222-2222-2222-222222222222');
  raise notice 'FAIL_classmate_read_answers';
exception when sqlstate '42501' then
  raise notice 'blocked_classmate';
end $$;

\echo ''
\echo '--- 7. a learner cannot read their OWN answers through the teacher path ---'
-- Harmless in itself, but it would mean the guard is checking membership
-- rather than ownership, which is the mistake that opens case 8.
set request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';
do $$
begin
  perform * from public.learner_last_wrong(
    (select id from public.classes where name = 'Form 4 Akaun'),
    'b2222222-2222-2222-2222-222222222222');
  raise notice 'FAIL_member_read_via_teacher_path';
exception when sqlstate '42501' then
  raise notice 'blocked_self_via_teacher_path';
end $$;

\echo ''
\echo '--- 8. owning SOME class does not grant reading an arbitrary learner ---'
-- The other teacher owns a real class. Aina is not in it. If the guard only
-- checked owns_class(), this would return her answers.
set request.jwt.claim.sub = 'b4444444-4444-4444-4444-444444444444';
do $$
begin
  perform * from public.learner_last_wrong(
    (select id from public.classes where name = 'Someone Else'),
    'b2222222-2222-2222-2222-222222222222');
  raise notice 'FAIL_other_teacher_read_foreign_learner';
exception when sqlstate '42501' then
  raise notice 'blocked_foreign_learner';
end $$;

\echo ''
\echo '--- 9. a teacher cannot pass someone else''s class id ---'
set request.jwt.claim.sub = 'b1111111-1111-1111-1111-111111111111';
do $$
begin
  perform * from public.learner_last_wrong(
    (select id from public.classes where name = 'Someone Else'),
    'b5555555-5555-5555-5555-555555555555');
  raise notice 'FAIL_non_owner_read';
exception when sqlstate '42501' then
  raise notice 'blocked_non_owner';
end $$;

\echo ''
\echo '--- 10. a caller with no identity at all is refused ---'
-- The `anon` ROLE is not the point: an anonymous Supabase user still has a
-- uid and may legitimately own a class, which is why 0007 grants execute to
-- anon. What must be refused is a request carrying no subject — auth.uid()
-- null, so owns_class() cannot be true for anyone.
set role anon;
set request.jwt.claim.sub = '';
do $$
begin
  perform * from public.learner_last_wrong(
    (select id from public.classes where name = 'Form 4 Akaun'),
    'b2222222-2222-2222-2222-222222222222');
  raise notice 'FAIL_anon_read';
exception when others then
  raise notice 'blocked_anon';
end $$;

\echo ''
\echo '--- 11. the stranger''s answers are unreachable from the real class ---'
set role authenticated;
set request.jwt.claim.sub = 'b1111111-1111-1111-1111-111111111111';
select count(*) = 0 as stranger_unreachable
from public.learner_last_wrong(
  (select id from public.classes where join_code = :'c_join_code'),
  'b2222222-2222-2222-2222-222222222222')
where chosen::text like '%SECRET%';

\echo ''
\echo '--- 12. the function is not executable by PUBLIC ---'
select has_function_privilege('authenticated', 'public.learner_last_wrong(uuid,uuid)', 'execute') as granted_authenticated,
       has_function_privilege('anon',          'public.learner_last_wrong(uuid,uuid)', 'execute') as granted_anon;
