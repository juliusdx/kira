-- Kira — remove a throwaway user left behind by a verification probe.
-- Run in the Supabase SQL Editor. NOT a migration; nothing here is applied
-- automatically, and it is only needed after a probe fails to clean up.
--
-- Why this is ever needed
--   Verifying something against the live project sometimes means creating a
--   real anonymous learner with real progress rows. Normally the probe deletes
--   its own rows at the end. It CANNOT if its access token is lost first (a
--   browser reload throws away anything held in a closure), because RLS only
--   ever lets a user delete their OWN rows, and there is no service_role key
--   on Julius's machine. At that point only the SQL Editor can finish the job.
--   Prevention: stash a probe JWT in sessionStorage, not a closure.
--
--   Every table references auth.users ON DELETE CASCADE (profiles,
--   review_state, attempts, class_members, push_subscriptions), so removing
--   the user removes everything they own in one statement.
--
-- Last used: 2026-07-28, to remove two probe learners left by the roster
-- verification (7 reviews / 13 attempts, and 7 reviews / 35 attempts).
-- Confirmed 0 rows remaining afterwards.

-- ---------------------------------------------------------------------------
-- STEP 0 — ONLY if you have no ids.
--
-- `npm run test:integration` signs in ~3 real anonymous users per run and can
-- delete its own rows but not its own auth users. Since 2026-07-29 each run
-- appends the ids it created to `.probe-users.local` (gitignored) — if that
-- file covers the run you are cleaning, use those ids with STEP 1 and skip
-- this section entirely. Ids are the safe path.
--
-- This section is for the runs from BEFORE that, where nothing was recorded.
-- It finds users by FOOTPRINT instead: no email, and nothing to their name.
--
-- ⚠️ READ THIS BEFORE RUNNING THE DELETE.
--   A real learner who installed the app and has not practised yet has EXACTLY
--   the same footprint as a probe. There is no way to tell them apart from the
--   data alone. What makes this tolerable rather than reckless is that such a
--   user owns nothing: deleting them costs them no progress, and their next
--   launch mints a fresh anonymous id (which the app does per-device and
--   per-origin anyway). If that is not a trade you want, delete nothing and
--   wait until every remaining probe is one you have an id for.
--
--   Cross-check `created_at` against when you actually ran the suite. Probes
--   arrive in bursts of about three within the same few seconds.
-- ---------------------------------------------------------------------------
select
  u.id,
  u.created_at,
  u.last_sign_in_at,
  p.display_name,
  p.avatar,
  (select count(*) from public.review_state       r where r.user_id  = u.id) as reviews,
  (select count(*) from public.attempts           a where a.user_id  = u.id) as attempts,
  (select count(*) from public.class_members      m where m.user_id  = u.id) as memberships,
  (select count(*) from public.classes            c where c.owner_id = u.id) as owns_classes,
  (select count(*) from public.push_subscriptions s where s.user_id  = u.id) as push_subs
from auth.users u
left join public.profiles p on p.id = u.id
where u.email is null                    -- never an account someone signed up for
  and not exists (select 1 from public.review_state       r where r.user_id  = u.id)
  and not exists (select 1 from public.attempts           a where a.user_id  = u.id)
  and not exists (select 1 from public.class_members      m where m.user_id  = u.id)
  and not exists (select 1 from public.classes            c where c.owner_id = u.id)
  and not exists (select 1 from public.push_subscriptions s where s.user_id  = u.id)
  and coalesce(p.display_name, '') = ''  -- someone who named themselves is a person
  and p.avatar is null                   -- ...so is someone who picked a face
order by u.created_at desc;

-- ---------------------------------------------------------------------------
-- STEP 0b — two sanity checks before deleting a large batch. READ-ONLY.
--
-- A. Are the candidates BURST-shaped? One `npm run test:integration` mints
--    about ten accounts within a couple of seconds. A real person installing
--    the app arrives alone. A row with accounts = 1 or 2 at a time that does
--    not line up with a run is the one to look at twice.
-- ---------------------------------------------------------------------------
with candidates as (
  select u.id, u.created_at
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.email is null
    and not exists (select 1 from public.review_state       r where r.user_id  = u.id)
    and not exists (select 1 from public.attempts           a where a.user_id  = u.id)
    and not exists (select 1 from public.class_members      m where m.user_id  = u.id)
    and not exists (select 1 from public.classes            c where c.owner_id = u.id)
    and not exists (select 1 from public.push_subscriptions s where s.user_id  = u.id)
    and coalesce(p.display_name, '') = ''
    and p.avatar is null
)
select
  date_trunc('minute', created_at)  as burst_minute,
  count(*)                          as accounts,
  max(created_at) - min(created_at) as spread
from candidates
group by 1
order by 1 desc;

-- ---------------------------------------------------------------------------
-- B. Who SURVIVES the delete? Everyone it would not touch.
--    Ariel and Julius MUST both appear here. If either is missing, stop —
--    it means a guard is not catching what it is supposed to.
-- ---------------------------------------------------------------------------
select
  u.id,
  u.email is not null as has_email,
  p.display_name,
  p.avatar,
  (select count(*) from public.review_state       r where r.user_id  = u.id) as reviews,
  (select count(*) from public.attempts           a where a.user_id  = u.id) as attempts,
  (select count(*) from public.class_members      m where m.user_id  = u.id) as memberships,
  (select count(*) from public.classes            c where c.owner_id = u.id) as owns_classes,
  (select count(*) from public.push_subscriptions s where s.user_id  = u.id) as push_subs,
  u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where u.email is not null
   or exists (select 1 from public.review_state       r where r.user_id  = u.id)
   or exists (select 1 from public.attempts           a where a.user_id  = u.id)
   or exists (select 1 from public.class_members      m where m.user_id  = u.id)
   or exists (select 1 from public.classes            c where c.owner_id = u.id)
   or exists (select 1 from public.push_subscriptions s where s.user_id  = u.id)
   or coalesce(p.display_name, '') <> ''
   or p.avatar is not null
order by u.created_at;

-- Delete exactly what that listed, with every guard repeated so a stale or
-- mistyped id cannot widen it. Wrapped so you can inspect the count and roll
-- back if it is not what you expected.
--
-- begin;
--   delete from auth.users u
--   where u.email is null
--     and not exists (select 1 from public.review_state       r where r.user_id  = u.id)
--     and not exists (select 1 from public.attempts           a where a.user_id  = u.id)
--     and not exists (select 1 from public.class_members      m where m.user_id  = u.id)
--     and not exists (select 1 from public.classes            c where c.owner_id = u.id)
--     and not exists (select 1 from public.push_subscriptions s where s.user_id  = u.id)
--     and not exists (select 1 from public.profiles pr
--                     where pr.id = u.id
--                       and (coalesce(pr.display_name, '') <> '' or pr.avatar is not null))
--     -- belt and braces: never you
--     and u.id <> 'bb520b30-733d-4250-8f5e-8668e2af9df0'
--   returning u.id, u.created_at;
--   -- happy with the count? commit;   not sure? rollback;
-- rollback;

-- ---------------------------------------------------------------------------
-- STEP 1 — find the probe, and LOOK before deleting anything.
--
-- Prefer matching on the user id you already know. Match on display_name only
-- to discover an id you have lost, and only when the name is unmistakable — a
-- plausible human name like "Nurul" WILL eventually collide with a real
-- learner. Once you have the id, use the id.
-- ---------------------------------------------------------------------------
select
  p.id,
  p.display_name,
  (select count(*) from public.review_state  r where r.user_id  = p.id) as reviews,
  (select count(*) from public.attempts      a where a.user_id  = p.id) as attempts,
  (select count(*) from public.class_members m where m.user_id  = p.id) as memberships,
  (select count(*) from public.classes       c where c.owner_id = p.id) as owns_classes,
  (select min(a.created_at) from public.attempts a where a.user_id = p.id) as first_attempt,
  (select string_agg(distinct a.item_id, ', ' order by a.item_id)
     from public.attempts a where a.user_id = p.id) as items
from public.profiles p
where p.id in ('00000000-0000-0000-0000-000000000000')   -- <-- the probe id(s)
   -- or p.display_name = 'Something (probe)'            -- <-- only to recover a lost id
;

-- Check before continuing:
--   * exactly the rows you expect, and no more
--   * memberships = 0 and owns_classes = 0
--   * `items` are the probe's items, and `first_attempt` is when you ran it
-- Anything else: stop.

-- ---------------------------------------------------------------------------
-- STEP 2 — delete. The two guards are the point: a real learner is IN a class,
-- so this refuses to remove them even if an id or name were wrong.
-- ---------------------------------------------------------------------------
delete from auth.users u
where u.id in ('00000000-0000-0000-0000-000000000000')   -- <-- the probe id(s)
  and not exists (select 1 from public.class_members m where m.user_id  = u.id)
  and not exists (select 1 from public.classes       c where c.owner_id = u.id)
returning u.id;

-- ---------------------------------------------------------------------------
-- STEP 3 — confirm. Expect a single row of zeros.
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.profiles     where id      in ('00000000-0000-0000-0000-000000000000')) as profiles_left,
  (select count(*) from public.review_state where user_id in ('00000000-0000-0000-0000-000000000000')) as reviews_left,
  (select count(*) from public.attempts     where user_id in ('00000000-0000-0000-0000-000000000000')) as attempts_left;

-- ---------------------------------------------------------------------------
-- OPTIONAL — a wider look, for eyeballing only. Every user holding practice
-- data who is in no class. That legitimately includes anyone practising solo
-- (your own phone, a learner who has not joined yet), so do NOT delete from
-- this list blindly. It is here to spot litter you had forgotten about.
-- ---------------------------------------------------------------------------
-- select
--   p.id, p.display_name,
--   (select count(*) from public.review_state r where r.user_id = p.id) as reviews,
--   (select count(*) from public.attempts     a where a.user_id = p.id) as attempts,
--   (select max(a.created_at) from public.attempts a where a.user_id = p.id) as last_seen
-- from public.profiles p
-- where not exists (select 1 from public.class_members m where m.user_id  = p.id)
--   and not exists (select 1 from public.classes       c where c.owner_id = p.id)
--   and (exists (select 1 from public.review_state r where r.user_id = p.id)
--     or exists (select 1 from public.attempts     a where a.user_id = p.id))
-- order by last_seen desc nulls last;
