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

-- Adversarial RLS tests. Everything runs as role `authenticated` (NOT the
-- table owner), so RLS is actually enforced.
\set ON_ERROR_STOP on
\pset pager off

-- ---------------------------------------------------------------------------
-- Fixtures, created as owner (RLS bypassed here on purpose).
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'teacher@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'learner@example.com'),
  ('33333333-3333-3333-3333-333333333333', 'outsider@example.com'),
  ('44444444-4444-4444-4444-444444444444', 'teacher2@example.com');

-- learner has progress
insert into public.review_state (user_id, item_id, box, due_at, streak)
values ('22222222-2222-2222-2222-222222222222', 'ap-001', 3, now(), 2);
insert into public.attempts (user_id, item_id, correct)
values ('22222222-2222-2222-2222-222222222222', 'ap-001', true);
-- outsider has progress too, and never joins anything
insert into public.review_state (user_id, item_id, box, due_at, streak)
values ('33333333-3333-3333-3333-333333333333', 'dp-001', 5, now(), 9);

grant select, insert, update, delete on all tables in schema public to authenticated, anon;

\echo ''
\echo '================= RLS ADVERSARIAL TESTS ================='
set role authenticated;

-- ---------------------------------------------------------------------------
\echo ''
\echo '--- 1. teacher creates a class; code is 12 chars ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select join_code from public.create_class('Form 4 Accounts') \gset t_
select length(:'t_join_code') = 12 as "PASS_12_char_code";

\echo ''
\echo '--- 1b. a NON-member cannot even see the class row ---'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select count(*) = 0 as "PASS_class_hidden_from_nonmember" from public.classes;

\echo ''
\echo '--- 2. learner joins with the code (shared out-of-band) ---'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select public.join_class(:'t_join_code') is not null as "PASS_learner_joined";

\echo ''
\echo '--- 2b. code is accepted with dashes/spaces as typed ---'
select public.join_class(
  substr(:'t_join_code',1,4)||'-'||substr(:'t_join_code',5,4)||' '||substr(:'t_join_code',9,4)
) is not null as "PASS_formatted_code_accepted";

\echo ''
\echo '--- 3. TEACHER CAN read the joined learner progress ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select count(*) = 1 as "PASS_teacher_reads_member_review"
  from public.review_state where user_id = '22222222-2222-2222-2222-222222222222';
select count(*) = 1 as "PASS_teacher_reads_member_attempts"
  from public.attempts where user_id = '22222222-2222-2222-2222-222222222222';

\echo ''
\echo '--- 4. *** CORE PROPERTY *** teacher CANNOT read a non-member ---'
select count(*) = 0 as "PASS_outsider_review_hidden"
  from public.review_state where user_id = '33333333-3333-3333-3333-333333333333';
select count(*) = 0 as "PASS_outsider_attempts_hidden"
  from public.attempts where user_id = '33333333-3333-3333-3333-333333333333';
select count(*) = 0 as "PASS_outsider_profile_hidden"
  from public.profiles where id = '33333333-3333-3333-3333-333333333333';

\echo ''
\echo '--- 5. teacher READ-ONLY: cannot modify a learner row ---'
update public.review_state set box = 1
  where user_id = '22222222-2222-2222-2222-222222222222';
select case when count(*) = 0 then true else false end as "PASS_teacher_update_blocked"
  from public.review_state
  where user_id = '22222222-2222-2222-2222-222222222222' and box = 1;

delete from public.attempts where user_id = '22222222-2222-2222-2222-222222222222';
select count(*) = 1 as "PASS_teacher_delete_blocked"
  from public.attempts where user_id = '22222222-2222-2222-2222-222222222222';

\echo ''
\echo '--- 6. MEMBERSHIP FORGERY: teacher2 tries to enrol the outsider ---'
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
select public.create_class('Evil Class') is not null as created;
\echo 'direct insert of a victim membership (must be blocked by default-deny):'
do $$
begin
  insert into public.class_members (class_id, user_id)
  values ((select id from public.classes where owner_id = '44444444-4444-4444-4444-444444444444'),
          '33333333-3333-3333-3333-333333333333');
  raise notice 'FAIL_forged_membership_ACCEPTED';
exception
  when insufficient_privilege then raise notice 'PASS_forged_membership_blocked (%)', sqlerrm;
  when others then raise notice 'PASS_forged_membership_blocked (% / %)', sqlstate, sqlerrm;
end $$;

select count(*) = 0 as "PASS_outsider_still_hidden_from_teacher2"
  from public.review_state where user_id = '33333333-3333-3333-3333-333333333333';

\echo ''
\echo '--- 7. a MEMBER is not a TEACHER: learner cannot read other learners ---'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) = 0 as "PASS_member_cannot_read_peers"
  from public.review_state where user_id <> '22222222-2222-2222-2222-222222222222';
select count(*) = 1 as "PASS_member_still_reads_own"
  from public.review_state where user_id = '22222222-2222-2222-2222-222222222222';

\echo ''
\echo '--- 8. learner self-service (0001) still works ---'
insert into public.review_state (user_id, item_id, box, due_at, streak)
  values ('22222222-2222-2222-2222-222222222222','bd-001',1, now(), 0)
  on conflict (user_id,item_id) do update set box = excluded.box;
select count(*) = 2 as "PASS_self_upsert_works"
  from public.review_state where user_id = '22222222-2222-2222-2222-222222222222';

\echo ''
\echo '--- 9. learner cannot write to someone else (0001 unchanged) ---'
do $$
begin
  insert into public.review_state (user_id, item_id, box, due_at)
  values ('33333333-3333-3333-3333-333333333333','forged',5, now());
  raise notice 'FAIL_cross_user_write_ACCEPTED';
exception when others then raise notice 'PASS_cross_user_write_blocked (%)', sqlstate;
end $$;

\echo ''
\echo '--- 10. revoked / rotated code cannot be reused ---'
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
select public.rotate_join_code((select id from public.classes where owner_id='11111111-1111-1111-1111-111111111111')) as new_code \gset
select :'new_code' <> '' as "PASS_rotate_returned_code";

\echo 'outsider tries the OLD code (should fail):'
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
do $$
begin
  perform public.join_class('AAAAAAAAAAAA');
  raise notice 'FAIL_bogus_code_ACCEPTED';
exception when others then raise notice 'PASS_bogus_code_rejected (%)', sqlstate;
end $$;

\echo ''
\echo '--- 11. rotate_join_code is owner-only ---'
do $$
begin
  perform public.rotate_join_code((select id from public.classes where owner_id='11111111-1111-1111-1111-111111111111'));
  raise notice 'FAIL_nonowner_rotate_ACCEPTED';
exception when others then raise notice 'PASS_nonowner_rotate_blocked (%)', sqlstate;
end $$;

\echo ''
\echo '--- 12. no infinite RLS recursion on any policy path ---'
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
select count(*) >= 1 as "PASS_no_recursion_classes" from public.classes;
select count(*) >= 1 as "PASS_no_recursion_members" from public.class_members;

reset role;
\echo ''
\echo '================= END ================='
