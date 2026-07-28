-- Kira — remove the throwaway users left behind by verification probes.
-- Run in the Supabase SQL Editor. NOT a migration: this is a one-off tidy-up
-- and is safe to delete from the repo once it has been run.
--
-- Background
--   Verifying the teacher/parent roster against the live project meant creating
--   real anonymous learners with real progress rows. Two of them could not
--   clean up after themselves: their access tokens lived in a browser page that
--   was later reloaded, and RLS only ever lets a user delete their OWN rows.
--
--   Every table references auth.users ON DELETE CASCADE (profiles,
--   review_state, attempts, class_members, push_subscriptions), so removing the
--   user removes everything they own in one statement.
--
-- Safety
--   Step 1 only LOOKS. Read it before running step 2.
--   Step 2 refuses to touch anyone who is in a class or owns one, so even if a
--   name matched a real learner they would be skipped — a real learner is in a
--   class. Probe 1 is matched by its exact user id, not by name, because
--   "Nurul" is a perfectly plausible real classmate.

-- ---------------------------------------------------------------------------
-- STEP 1 — preview. Expect exactly 2 rows, both with 0 memberships and
-- 0 owned classes. If you see anything else, STOP and do not run step 2.
-- ---------------------------------------------------------------------------
select
  p.id,
  p.display_name,
  (select count(*) from public.review_state r where r.user_id = p.id) as reviews,
  (select count(*) from public.attempts     a where a.user_id = p.id) as attempts,
  (select count(*) from public.class_members m where m.user_id = p.id) as memberships,
  (select count(*) from public.classes      c where c.owner_id = p.id) as owns_classes,
  (select min(a.created_at) from public.attempts a where a.user_id = p.id) as first_attempt,
  (select string_agg(distinct a.item_id, ', ' order by a.item_id)
     from public.attempts a where a.user_id = p.id) as items
from public.profiles p
where p.id = '8aeea4ae-839a-42a7-9f00-df2a56d2085b'  -- probe 1, "Nurul"
   or p.display_name = 'Ariel (probe)';              -- probe 2

-- ---------------------------------------------------------------------------
-- STEP 2 — delete. Cascades profiles / review_state / attempts /
-- class_members / push_subscriptions. Returns what it actually removed.
-- ---------------------------------------------------------------------------
delete from auth.users u
where (
        u.id = '8aeea4ae-839a-42a7-9f00-df2a56d2085b'
        or u.id in (select id from public.profiles where display_name = 'Ariel (probe)')
      )
  -- belt and braces: never remove someone who is actually in a class,
  -- or who teaches one
  and not exists (select 1 from public.class_members m where m.user_id = u.id)
  and not exists (select 1 from public.classes      c where c.owner_id = u.id)
returning u.id;

-- ---------------------------------------------------------------------------
-- STEP 3 — confirm nothing is left. Expect 0 rows.
-- ---------------------------------------------------------------------------
select count(*) as probe_rows_remaining
from public.attempts
where user_id in (
  '8aeea4ae-839a-42a7-9f00-df2a56d2085b'
);

-- ---------------------------------------------------------------------------
-- OPTIONAL — a wider look, for eyeballing only. Lists every user holding
-- practice data who belongs to no class. That legitimately includes anyone
-- practising solo (your own phone, Ariel before she joined), so do NOT delete
-- from this list blindly — it is here so you can see whether any other probe
-- litter is lying around.
-- ---------------------------------------------------------------------------
-- select
--   p.id, p.display_name,
--   (select count(*) from public.review_state r where r.user_id = p.id) as reviews,
--   (select count(*) from public.attempts     a where a.user_id = p.id) as attempts,
--   (select max(a.created_at) from public.attempts a where a.user_id = p.id) as last_seen
-- from public.profiles p
-- where not exists (select 1 from public.class_members m where m.user_id = p.id)
--   and not exists (select 1 from public.classes      c where c.owner_id = p.id)
--   and (
--     exists (select 1 from public.review_state r where r.user_id = p.id)
--     or exists (select 1 from public.attempts a where a.user_id = p.id)
--   )
-- order by last_seen desc nulls last;
