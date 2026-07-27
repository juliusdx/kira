-- Kira — web push daily reminders
-- Paste into the Supabase SQL Editor and run, AFTER 0003_leaderboard.sql.
-- Safe to re-run: every statement is idempotent.
--
-- Why reminders matter here: spaced repetition only works if the learner comes
-- back on the day an item is due. The reminder is the delivery mechanism, not
-- decoration — a review nobody returns for simply does not happen.

-- ---------------------------------------------------------------------------
-- One row per browser/device push subscription. A learner may have several
-- (phone, laptop), so the endpoint is the natural key.
-- ---------------------------------------------------------------------------
create table if not exists public.push_subscriptions (
  endpoint    text primary key,
  user_id     uuid not null references auth.users on delete cascade,
  p256dh      text not null,
  auth        text not null,
  -- IANA zone name, e.g. 'Asia/Kuala_Lumpur'. Stored per subscription because
  -- the same learner's laptop and phone can be in different places.
  timezone    text not null default 'UTC',
  /* local hour (0-23) the learner wants to be nudged */
  send_hour   int  not null default 19 check (send_hour between 0 and 23),
  /* set after each send so the cron cannot nag twice in a day */
  last_sent_on date,
  failure_count int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Self-service only. Notably NOT readable by a teacher: a push endpoint is a
-- device handle, not progress, and nothing in the teacher dashboard needs it.
drop policy if exists "push subs are self-service" on public.push_subscriptions;
create policy "push subs are self-service" on public.push_subscriptions
  for all
  using      (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Who should be nudged right now?
--
-- SECURITY DEFINER because the sender runs as the service role and needs to
-- read across users. Returns only what a push needs: where to send, how to
-- encrypt, and how many reviews are waiting. No answers, no progress detail.
--
-- Selection rules, in order of how easily each gets forgotten:
--   * the learner's LOCAL hour must equal their chosen hour
--   * they must not already have been sent one today (their local date)
--   * they must actually have reviews due — never send "you have 0 reviews"
--   * dead endpoints (5+ consecutive failures) are skipped
-- ---------------------------------------------------------------------------
create or replace function public.due_reminders()
returns table (
  endpoint  text,
  p256dh    text,
  auth      text,
  due_count bigint,
  local_date date
)
language sql
security definer
stable
set search_path = public
as $$
  select
    s.endpoint,
    s.p256dh,
    s.auth,
    count(r.item_id) as due_count,
    (now() at time zone s.timezone)::date as local_date
  from public.push_subscriptions s
  join public.review_state r
    on r.user_id = s.user_id
   and r.due_at <= now()
  where s.failure_count < 5
    and extract(hour from (now() at time zone s.timezone))::int = s.send_hour
    and (s.last_sent_on is null
         or s.last_sent_on < (now() at time zone s.timezone)::date)
  group by s.endpoint, s.p256dh, s.auth, s.timezone
  having count(r.item_id) > 0;
$$;

revoke all on function public.due_reminders() from public, anon, authenticated;
-- service_role only: this is the sender's query, never the client's.
grant execute on function public.due_reminders() to service_role;

-- Bookkeeping for the sender: mark a send, or record a failure so a dead
-- endpoint eventually stops being retried forever.
create or replace function public.mark_reminder_sent(
  p_endpoint text,
  p_date     date
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_subscriptions
     set last_sent_on = p_date, failure_count = 0
   where endpoint = p_endpoint;
$$;

create or replace function public.mark_reminder_failed(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_subscriptions
     set failure_count = failure_count + 1
   where endpoint = p_endpoint;
$$;

revoke all on function public.mark_reminder_sent(text, date) from public, anon, authenticated;
revoke all on function public.mark_reminder_failed(text)     from public, anon, authenticated;
grant execute on function public.mark_reminder_sent(text, date) to service_role;
grant execute on function public.mark_reminder_failed(text)     to service_role;
