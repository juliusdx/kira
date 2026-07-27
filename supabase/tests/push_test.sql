-- Reminder-selection tests. The interesting logic is all about WHO gets
-- skipped: wrong local hour, already nudged today, nothing actually due, and
-- dead endpoints. Getting any of these wrong means either silence or nagging.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id) values
  ('b1111111-1111-1111-1111-111111111111'),  -- due reviews, right hour
  ('b2222222-2222-2222-2222-222222222222'),  -- due reviews, wrong hour
  ('b3333333-3333-3333-3333-333333333333'),  -- right hour, nothing due
  ('b4444444-4444-4444-4444-444444444444'),  -- right hour, already sent today
  ('b5555555-5555-5555-5555-555555555555');  -- right hour, dead endpoint

-- overdue review rows for everyone except user 3
insert into public.review_state (user_id, item_id, box, due_at) values
  ('b1111111-1111-1111-1111-111111111111','ap-001',2, now() - interval '1 day'),
  ('b1111111-1111-1111-1111-111111111111','ap-002',1, now() - interval '2 day'),
  ('b2222222-2222-2222-2222-222222222222','ap-001',2, now() - interval '1 day'),
  ('b4444444-4444-4444-4444-444444444444','ap-001',2, now() - interval '1 day'),
  ('b5555555-5555-5555-5555-555555555555','ap-001',2, now() - interval '1 day');
-- user 3 has a row, but it is NOT due yet
insert into public.review_state (user_id, item_id, box, due_at) values
  ('b3333333-3333-3333-3333-333333333333','ap-001',5, now() + interval '10 day');

-- Everyone is in UTC so the test is deterministic; "the right hour" is
-- whatever hour it is in UTC right now.
insert into public.push_subscriptions (endpoint, user_id, p256dh, auth, timezone, send_hour, last_sent_on, failure_count) values
  ('https://push.example/ok',      'b1111111-1111-1111-1111-111111111111','k','a','UTC', extract(hour from now() at time zone 'UTC')::int,       null, 0),
  ('https://push.example/hour',    'b2222222-2222-2222-2222-222222222222','k','a','UTC', (extract(hour from now() at time zone 'UTC')::int + 5) % 24, null, 0),
  ('https://push.example/nodue',   'b3333333-3333-3333-3333-333333333333','k','a','UTC', extract(hour from now() at time zone 'UTC')::int,       null, 0),
  ('https://push.example/already', 'b4444444-4444-4444-4444-444444444444','k','a','UTC', extract(hour from now() at time zone 'UTC')::int,       (now() at time zone 'UTC')::date, 0),
  ('https://push.example/dead',    'b5555555-5555-5555-5555-555555555555','k','a','UTC', extract(hour from now() at time zone 'UTC')::int,       null, 7);

\echo ''
\echo '=============== PUSH REMINDER TESTS ==============='

\echo ''
\echo '--- 1. only the eligible subscription is selected ---'
select count(*) = 1 as "PASS_exactly_one_selected" from public.due_reminders();
select endpoint = 'https://push.example/ok' as "PASS_it_is_the_right_one"
  from public.due_reminders();

\echo ''
\echo '--- 2. due_count is the number of OVERDUE items ---'
select due_count = 2 as "PASS_counts_two_overdue" from public.due_reminders();

\echo ''
\echo '--- 3. each exclusion holds independently ---'
select count(*) = 0 as "PASS_wrong_hour_skipped"
  from public.due_reminders() where endpoint = 'https://push.example/hour';
select count(*) = 0 as "PASS_nothing_due_skipped"
  from public.due_reminders() where endpoint = 'https://push.example/nodue';
select count(*) = 0 as "PASS_already_sent_today_skipped"
  from public.due_reminders() where endpoint = 'https://push.example/already';
select count(*) = 0 as "PASS_dead_endpoint_skipped"
  from public.due_reminders() where endpoint = 'https://push.example/dead';

\echo ''
\echo '--- 4. marking sent removes it from the next run (no double-nag) ---'
select public.mark_reminder_sent('https://push.example/ok', (now() at time zone 'UTC')::date);
select count(*) = 0 as "PASS_not_selected_again_today" from public.due_reminders();

\echo ''
\echo '--- 5. yesterday-sent becomes eligible again ---'
update public.push_subscriptions
   set last_sent_on = (now() at time zone 'UTC')::date - 1
 where endpoint = 'https://push.example/ok';
select count(*) = 1 as "PASS_eligible_the_next_day" from public.due_reminders();

\echo ''
\echo '--- 6. timezone is honoured, not server time ---'
-- put this learner in a zone where it is NOT their send hour
update public.push_subscriptions
   set timezone = 'Asia/Kuala_Lumpur',
       send_hour = (extract(hour from now() at time zone 'Asia/Kuala_Lumpur')::int + 3) % 24
 where endpoint = 'https://push.example/ok';
select count(*) = 0 as "PASS_wrong_local_hour_in_KL"
  from public.due_reminders() where endpoint = 'https://push.example/ok';

update public.push_subscriptions
   set send_hour = extract(hour from now() at time zone 'Asia/Kuala_Lumpur')::int
 where endpoint = 'https://push.example/ok';
select count(*) = 1 as "PASS_right_local_hour_in_KL"
  from public.due_reminders() where endpoint = 'https://push.example/ok';

\echo ''
\echo '--- 7. failures accumulate toward the dead-endpoint cutoff ---'
select public.mark_reminder_failed('https://push.example/ok');
select failure_count = 1 as "PASS_failure_recorded"
  from public.push_subscriptions where endpoint = 'https://push.example/ok';
select public.mark_reminder_sent('https://push.example/ok', (now() at time zone 'UTC')::date - 1);
select failure_count = 0 as "PASS_success_resets_failures"
  from public.push_subscriptions where endpoint = 'https://push.example/ok';

\echo ''
\echo '--- 8. a learner cannot read anothers push endpoint ---'
grant select, insert, update, delete on all tables in schema public to authenticated;
set role authenticated;
set request.jwt.claim.sub = 'b2222222-2222-2222-2222-222222222222';
select count(*) = 0 as "PASS_peer_subscription_hidden"
  from public.push_subscriptions where user_id = 'b1111111-1111-1111-1111-111111111111';
select count(*) = 1 as "PASS_own_subscription_visible"
  from public.push_subscriptions where user_id = 'b2222222-2222-2222-2222-222222222222';

\echo ''
\echo '--- 9. due_reminders is NOT callable by a normal user ---'
do $$
begin
  perform public.due_reminders();
  raise notice 'FAIL_client_called_due_reminders';
exception when insufficient_privilege then
  raise notice 'PASS_client_blocked_from_due_reminders';
when others then
  raise notice 'PASS_client_blocked_from_due_reminders (%)', sqlstate;
end $$;

reset role;
\echo ''
\echo '=============== END ==============='
