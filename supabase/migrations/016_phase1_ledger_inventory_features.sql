-- ============================================================
-- Phase 1 of the "ledger search / inventory party fields / settle
-- account / user commodities" feature batch. Three independent
-- changes, grouped in one migration since they ship together:
--
-- 1. Ledger entries never had a DELETE policy — needed for the new
--    "Settle Account" action (حساب تصفيه کړی), which wipes a single
--    counterparty's entries down to zero after password
--    re-verification in the app. Gated the same way as insert/update:
--    owner only, and only while subscribed (consistent with every
--    other ledger write policy — a lapsed subscription shouldn't be
--    able to destroy data any more than it can create it).
--
-- 2. inventory_transactions gets four new nullable columns to record
--    who a purchase was bought from / a sale was made to. Kept as
--    plain text fields on the transaction itself (not a foreign key
--    to counterparties) — a supplier/buyer here is often a one-off
--    or a different kind of relationship than a ledger contact, and
--    forcing them through the same table would conflate "people I
--    extend credit to" with "people I trade goods with."
--
-- 3. commodities becomes user-extensible. A new nullable
--    created_by_profile_id distinguishes seeded/global commodities
--    (null) from ones a shop owner added themselves (their own
--    profile id). RLS is updated so everyone still sees the global
--    list, but a user-added commodity is visible only to its creator
--    — otherwise one shop's typo'd or oddly-named custom commodity
--    would pollute the dropdown for every other shop in the system.
-- ============================================================

-- --- 1. Ledger entry deletion (for Settle Account) ---
drop policy if exists "delete own ledger" on public.ledger_entries;
create policy "delete own ledger" on public.ledger_entries
  for delete using (
    auth.uid() = profile_id and public.has_active_subscription(profile_id)
  );

-- --- 2. Counterparty-info fields on inventory transactions ---
alter table public.inventory_transactions
  add column if not exists party_name text,
  add column if not exists party_phone text,
  add column if not exists party_whatsapp text,
  add column if not exists party_address text;

comment on column public.inventory_transactions.party_name is
  'Who the goods were bought from (purchase) or sold to (sale). Optional, free text — not a counterparties FK.';

-- --- 3. User-extensible commodities ---
alter table public.commodities
  add column if not exists created_by_profile_id uuid references public.profiles(id);

drop policy if exists "authenticated read commodities" on public.commodities;
drop policy if exists "read commodities" on public.commodities;
create policy "read commodities" on public.commodities
  for select using (
    auth.role() = 'authenticated'
    and (created_by_profile_id is null or created_by_profile_id = auth.uid())
  );

drop policy if exists "users add own commodities" on public.commodities;
create policy "users add own commodities" on public.commodities
  for insert with check (
    auth.uid() = created_by_profile_id
    and public.has_active_subscription(created_by_profile_id)
  );
