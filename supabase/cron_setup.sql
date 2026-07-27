-- Schedule the reminder sender. Run this LAST — after 0004_push_reminders.sql
-- is applied AND `send-reminders` is deployed, because it calls the function's
-- live URL.
--
-- Runs hourly rather than once a day on purpose: learners choose their own
-- local hour, so the sender has to wake up every hour and pick whoever's local
-- clock currently matches. due_reminders() does that selection.
--
-- BEFORE RUNNING, replace:
--   <SERVICE_ROLE_KEY>  Project Settings -> API -> service_role key
--   <CRON_SECRET>       any long random string; set the SAME value with
--                       `supabase secrets set CRON_SECRET=...` so the function
--                       rejects anything that is not this scheduler
--
-- Keep the service_role key out of git — it bypasses RLS entirely.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- idempotent: drop any previous schedule before recreating
select cron.unschedule('kira-send-reminders')
where exists (select 1 from cron.job where jobname = 'kira-send-reminders');

select cron.schedule(
  'kira-send-reminders',
  '5 * * * *',            -- :05 past every hour
  $$
  select net.http_post(
    url     := 'https://ccbioktxfpeqaocjkqpr.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type',   'application/json',
      'Authorization',  'Bearer <SERVICE_ROLE_KEY>',
      'x-cron-secret',  '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Useful afterwards:
--   select * from cron.job;                                   -- is it scheduled?
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select * from net._http_response order by created desc limit 10;  -- what came back
