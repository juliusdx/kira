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
