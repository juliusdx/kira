-- ===========================================================================
-- LOCAL TEST FILE — NEVER RUN THIS IN THE SUPABASE SQL EDITOR.
-- It writes fixture rows into auth.users, and the harness it depends on
-- replaces auth.uid(). Against production that breaks every RLS policy in the
-- app. It is only ever run by ./supabase/tests/run.sh against a throwaway
-- local Postgres.
--
-- The guard below is a hard stop, not a comment: a real Supabase auth.users
-- has an encrypted_password column and the harness's fake one never will.
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

-- item_notes tests (migration 0008).
--
-- Unlike 0005 and 0007 this is NOT a SECURITY DEFINER function, so the RLS
-- policy is the entire boundary and these tests are aimed straight at it. The
-- cases that matter are the ones where a row exists and must stay invisible: a
-- second teacher who keeps a note on the SAME item id, and a learner — because
-- a note is free text written by an adult and must never reach a child's
-- screen, which is the whole reason it is author-only rather than shared.
--
-- Note that RLS makes most of these silent: a filtered SELECT returns zero
-- rows and a filtered UPDATE/DELETE returns success having changed nothing
-- (the 204-not-403 gotcha). So every negative case asserts on what the row
-- actually holds afterwards, never on the absence of an error.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('c1111111-1111-1111-1111-111111111111', 'teacher@example.com'),
  ('c2222222-2222-2222-2222-222222222222', 'aina@example.com'),
  ('c3333333-3333-3333-3333-333333333333', 'other-teacher@example.com');

grant select, insert, update, delete on all tables in schema public to authenticated, anon;

\echo ''
\echo '=============== ITEM NOTES TESTS ==============='
set role authenticated;

-- The teacher and a learner share a class, so the learner is as close to the
-- note as anyone in the app ever gets.
set request.jwt.claim.sub = 'c1111111-1111-1111-1111-111111111111';
select join_code from public.create_class('Form 4 Akaun') \gset c_
set request.jwt.claim.sub = 'c2222222-2222-2222-2222-222222222222';
select public.join_class(:'c_join_code') is not null as joined_aina;

\echo ''
\echo '--- 1. a teacher can write a note and read it back ---'
set request.jwt.claim.sub = 'c1111111-1111-1111-1111-111111111111';
insert into public.item_notes (author_id, item_id, note) values
  ('c1111111-1111-1111-1111-111111111111', 'l30-balance-off',
   'The balance c/d goes on the SMALLER side.');
select count(*) = 1 as note_written
from public.item_notes where item_id = 'l30-balance-off';

\echo ''
\echo '--- 2. re-writing the same item updates rather than duplicating ---'
-- The UI saves on every edit, so the upsert path is the normal one, not the
-- exception. A second row per item would show the teacher a stale note.
insert into public.item_notes (author_id, item_id, note) values
  ('c1111111-1111-1111-1111-111111111111', 'l30-balance-off', 'Second try.')
on conflict (author_id, item_id) do update set note = excluded.note;
select count(*) = 1 as still_one_row, max(note) = 'Second try.' as note_updated
from public.item_notes where item_id = 'l30-balance-off';

\echo ''
\echo '--- 3. updated_at is set by the database, not by the writer ---'
-- A client cannot backdate or forward-date a note: the trigger overwrites
-- whatever was sent.
insert into public.item_notes (author_id, item_id, note, updated_at) values
  ('c1111111-1111-1111-1111-111111111111', 'dc-006', 'x',
   timestamptz '2001-01-01 00:00:00+00');
select updated_at > now() - interval '1 minute' as updated_at_is_server_clock
from public.item_notes where item_id = 'dc-006';

\echo ''
\echo '--- 4. an empty note is refused ---'
-- Clearing a note is a DELETE. Storing '''' would make "cleared" and "never
-- written" two states the UI has to tell apart for no benefit.
do $$
begin
  insert into public.item_notes (author_id, item_id, note) values
    ('c1111111-1111-1111-1111-111111111111', 'ap-001', '');
  raise notice 'FAIL_empty_note_stored';
exception when check_violation then
  raise notice 'blocked_empty_note';
end $$;

\echo ''
\echo '--- 5. an over-long note is refused ---'
do $$
begin
  insert into public.item_notes (author_id, item_id, note) values
    ('c1111111-1111-1111-1111-111111111111', 'ap-002', repeat('x', 2001));
  raise notice 'FAIL_oversized_note_stored';
exception when check_violation then
  raise notice 'blocked_oversized_note';
end $$;

\echo ''
\echo '--- 6. a note cannot be written on someone else''s behalf ---'
-- WITH CHECK, not just USING: without it a teacher could author rows that then
-- become invisible to them and visible to their victim.
do $$
begin
  insert into public.item_notes (author_id, item_id, note) values
    ('c3333333-3333-3333-3333-333333333333', 'l30-balance-off', 'PLANTED');
  raise notice 'FAIL_wrote_as_another_author';
exception when insufficient_privilege then
  raise notice 'blocked_foreign_author_write';
end $$;

\echo ''
\echo '--- 7. a second teacher''s note on the SAME item is invisible ---'
set request.jwt.claim.sub = 'c3333333-3333-3333-3333-333333333333';
insert into public.item_notes (author_id, item_id, note) values
  ('c3333333-3333-3333-3333-333333333333', 'l30-balance-off', 'OTHER_TEACHER_SECRET');
select count(*) = 1 as sees_only_own
from public.item_notes where item_id = 'l30-balance-off';
select not exists (
  select 1 from public.item_notes where note like '%Second try%'
) as cannot_read_first_teacher;

\echo ''
\echo '--- 8. the first teacher still sees only their own version ---'
set request.jwt.claim.sub = 'c1111111-1111-1111-1111-111111111111';
select count(*) = 1                     as sees_one_row,
       max(note) = 'Second try.'        as sees_own_text
from public.item_notes where item_id = 'l30-balance-off';
select not exists (
  select 1 from public.item_notes where note like '%OTHER_TEACHER_SECRET%'
) as cannot_read_other_teacher;

\echo ''
\echo '--- 9. a learner in the class cannot read their teacher''s notes ---'
-- The point of author-only. A note is an adult writing freely about a child''s
-- mistake; it is not feedback addressed to the child.
set request.jwt.claim.sub = 'c2222222-2222-2222-2222-222222222222';
select count(*) = 0 as learner_sees_nothing from public.item_notes;

\echo ''
\echo '--- 10. a learner cannot overwrite a note (silently or otherwise) ---'
-- RLS filters the UPDATE to zero rows and reports success, so the assertion
-- has to be on the row itself.
update public.item_notes set note = 'TAMPERED' where item_id = 'l30-balance-off';
delete from public.item_notes where item_id = 'l30-balance-off';
set request.jwt.claim.sub = 'c1111111-1111-1111-1111-111111111111';
select count(*) = 1              as survived_learner_delete,
       max(note) = 'Second try.' as survived_learner_update
from public.item_notes where item_id = 'l30-balance-off';

\echo ''
\echo '--- 11. the author can delete their own note ---'
delete from public.item_notes where item_id = 'dc-006';
select count(*) = 0 as author_can_delete
from public.item_notes where item_id = 'dc-006';

\echo ''
\echo '--- 12. a caller with no identity reads and writes nothing ---'
set role anon;
set request.jwt.claim.sub = '';
select count(*) = 0 as anonymous_sees_nothing from public.item_notes;
do $$
begin
  insert into public.item_notes (author_id, item_id, note) values
    ('c1111111-1111-1111-1111-111111111111', 'no-subject', 'PLANTED');
  raise notice 'FAIL_no_subject_write';
exception when insufficient_privilege then
  raise notice 'blocked_no_subject_write';
end $$;

\echo ''
\echo '--- 13. deleting the author removes the notes ---'
-- Probe sweeps delete auth.users rows; a note left behind would be an orphan
-- no policy can ever match again.
-- reset role, not `set role postgres`: the superuser is not called postgres on
-- every machine. It also makes the assertion stronger — as the owning role RLS
-- does not apply, so this checks the row is GONE, not merely invisible.
reset role;
delete from auth.users where id = 'c3333333-3333-3333-3333-333333333333';
select count(*) = 0 as notes_cascade_with_author
from public.item_notes
where author_id = 'c3333333-3333-3333-3333-333333333333';

\echo ''
\echo '--- 14. RLS is actually enabled on the table ---'
-- Without this the whole file passes for the wrong reason: as a non-owning
-- role every assertion above would still hold if the policies were absent but
-- the grants were missing, and vice versa.
select relrowsecurity as rls_enabled
from pg_class where oid = 'public.item_notes'::regclass;
select has_table_privilege('authenticated', 'public.item_notes', 'select') as granted_authenticated,
       has_table_privilege('anon',          'public.item_notes', 'select') as granted_anon;
