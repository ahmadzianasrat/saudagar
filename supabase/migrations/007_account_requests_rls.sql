-- ============================================================
-- account_requests was never given RLS policies in the original
-- schema. Same recurring pattern as admin_users/markets/commodities —
-- if RLS got enabled on this table (e.g. via Supabase's dashboard
-- advisor) without policies, it silently blocks EVERYTHING, including
-- the one thing this table absolutely must allow: an anonymous,
-- not-yet-logged-in user submitting a request via RequestAccessScreen.
-- ============================================================

alter table public.account_requests enable row level security;

-- Anyone — including anonymous, pre-login users — can create a
-- request. This is intentional: request-access happens BEFORE any
-- account exists, so there's no auth.uid() to check against.
drop policy if exists "anyone can request access" on public.account_requests;
create policy "anyone can request access" on public.account_requests
  for insert
  with check (true);

-- Only users with a matching admin_users row can read the queue —
-- this is what AccountRequestsScreen relies on for its direct client
-- query (approval/decline itself goes through service-role Edge
-- Functions, which bypass RLS regardless, so no update/delete policy
-- is needed here for the client).
drop policy if exists "admins read account requests" on public.account_requests;
create policy "admins read account requests" on public.account_requests
  for select
  using (
    exists (
      select 1 from public.admin_users
      where id = auth.uid()
    )
  );
