-- ============================================================
-- admin_users was never given an RLS policy in the original schema
-- (001_initial_schema.sql only enabled RLS on profiles, counterparties,
-- ledger_entries, inventory_items, inventory_transactions,
-- subscriptions, and prices — admin_users was missed).
--
-- If RLS later got enabled on this table (e.g. via Supabase's
-- dashboard security advisor, which nags about every public table
-- lacking RLS) without a policy being added, the table becomes fully
-- locked — RLS enabled + zero policies denies access to everyone,
-- including the row's own owner. This is the likely cause of an
-- admin logging in successfully but the app reporting "not set up
-- as an admin": the query silently returns nothing, not because the
-- row doesn't exist, but because it can't be read.
--
-- The Edge Functions (admin-approve-account, admin-decline-account,
-- and the prices-upload RLS check) all use the service role key,
-- which bypasses RLS entirely — so this issue is invisible from
-- those paths and only shows up in the admin panel's direct client-
-- side query.
-- ============================================================

alter table public.admin_users enable row level security;

drop policy if exists "admin reads own row" on public.admin_users;
create policy "admin reads own row" on public.admin_users
  for select using (auth.uid() = id);

-- No insert/update/delete policy is added deliberately — admin_users
-- rows are only ever created/modified via direct SQL (the initial
-- super_admin) or would go through a service-role Edge Function later
-- if you build an "admin invites another admin" flow. Client-side
-- writes to this table should stay blocked.
