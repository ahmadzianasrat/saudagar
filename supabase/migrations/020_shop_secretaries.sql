-- ============================================================
-- Secretary accounts — separate logins with real, RLS-enforced
-- permission limits, not just a shared password.
-- ------------------------------------------------------------
-- Problem this solves: a shop owner who hires a secretary to help
-- with the ledger/inventory previously had no choice but to share
-- their own login. That secretary then had exactly the owner's own
-- power — including editing or deleting any entry, settling
-- accounts, changing the shop profile, or changing the password out
-- from under the owner. If entries went missing or got altered,
-- there was no way to tell who did it or recover the original values.
--
-- Design: a secretary gets their OWN phone+password login (created by
-- the owner from the app, via the secretary-create Edge Function —
-- creating an auth user needs the service role key, which only Edge
-- Functions have). Their auth user has no `profiles` row of their
-- own; instead, a row in shop_secretaries links them to the owner's
-- profile_id. current_shop_profile_id() below resolves "which shop's
-- data should this login see" for both kinds of user, and every
-- table's policies are split so a secretary gets the same read/insert
-- access as the owner (add entries, add transactions, add contacts —
-- can't run a shop without that) but NONE of the existing
-- update/delete policies change at all — those already say
-- `auth.uid() = profile_id`, which only the owner's own auth id ever
-- satisfies, so update/delete stays owner-only automatically without
-- touching those policies. That's what makes this "real prevention":
-- it's enforced by Postgres for every request, not by what the app's
-- UI happens to show or hide.
--
-- Revoking a secretary (shop_secretaries.status = 'revoked') is
-- enough to cut off their access — current_shop_profile_id() stops
-- resolving for them, so every policy below denies them — without
-- needing to disable their auth login separately.
-- ============================================================

create table public.shop_secretaries (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null references public.profiles(id) on delete cascade,
  secretary_user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null,
  phone_number text not null,
  status text not null default 'active' check (status in ('active', 'revoked')),
  created_at timestamptz not null default now()
);

create index idx_shop_secretaries_owner on public.shop_secretaries (owner_profile_id);
create index idx_shop_secretaries_user on public.shop_secretaries (secretary_user_id);

alter table public.shop_secretaries enable row level security;

-- Owner has full control over their own secretaries (add, revoke,
-- rename — password resets go through the secretary-reset-password
-- Edge Function instead, since changing an auth user's password
-- needs the service role key).
create policy "owner manages own secretaries" on public.shop_secretaries
  for all
  using (owner_profile_id = auth.uid())
  with check (owner_profile_id = auth.uid());

-- A secretary can read their own membership row (so the app can show
-- them their name / confirm they're not revoked) — nothing else.
create policy "secretary reads own membership" on public.shop_secretaries
  for select
  using (secretary_user_id = auth.uid());

-- --- The core helper every other policy below builds on ---
-- Resolves to the shop's profile_id this login should operate
-- within: their own id if they're an owner (have a profiles row),
-- or their employer's profile_id if they're an active (not revoked)
-- secretary. Null if neither — e.g. a revoked secretary, or between
-- signup and profile creation. SECURITY DEFINER so it can read
-- shop_secretaries regardless of the calling policy's own
-- visibility into that table; STABLE so Postgres can cache the
-- result within one statement instead of re-resolving it per row.
create or replace function public.current_shop_profile_id()
returns uuid
language sql
security definer
stable
as $$
  select coalesce(
    (select id from public.profiles where id = auth.uid()),
    (select owner_profile_id from public.shop_secretaries
      where secretary_user_id = auth.uid() and status = 'active')
  );
$$;

-- ------------------------------------------------------------
-- profiles: an owner reads their own row; a secretary reads their
-- employer's row too (shop name/address/WhatsApp shown in headers
-- and on receipts). Update stays owner-only — unchanged, not
-- reproduced here.
-- ------------------------------------------------------------
drop policy if exists "own profile read" on public.profiles;
create policy "shop profile read" on public.profiles
  for select using (id = public.current_shop_profile_id());

-- ------------------------------------------------------------
-- ledger_entries: secretary gets the same read/insert as the owner;
-- update/delete policies are untouched (already owner-only).
-- ------------------------------------------------------------
drop policy if exists "read own ledger" on public.ledger_entries;
create policy "read shop ledger" on public.ledger_entries
  for select using (public.current_shop_profile_id() = profile_id);

drop policy if exists "write own ledger only if subscribed" on public.ledger_entries;
create policy "write shop ledger only if subscribed" on public.ledger_entries
  for insert with check (
    public.current_shop_profile_id() = profile_id and public.has_active_subscription(profile_id)
  );

-- ------------------------------------------------------------
-- inventory_items: same pattern.
-- ------------------------------------------------------------
drop policy if exists "read own inventory" on public.inventory_items;
create policy "read shop inventory" on public.inventory_items
  for select using (public.current_shop_profile_id() = profile_id);

drop policy if exists "write own inventory only if subscribed" on public.inventory_items;
create policy "write shop inventory only if subscribed" on public.inventory_items
  for insert with check (
    public.current_shop_profile_id() = profile_id and public.has_active_subscription(profile_id)
  );

-- ------------------------------------------------------------
-- inventory_transactions: ownership is via inventory_item_id, same
-- as the existing policies — just swapping which profile_id is
-- allowed to match.
-- ------------------------------------------------------------
drop policy if exists "read own inventory transactions" on public.inventory_transactions;
create policy "read shop inventory transactions" on public.inventory_transactions
  for select using (
    exists (
      select 1 from public.inventory_items
      where id = inventory_transactions.inventory_item_id
        and profile_id = public.current_shop_profile_id()
    )
  );

drop policy if exists "write own inventory transactions only if subscribed" on public.inventory_transactions;
create policy "write shop inventory transactions only if subscribed" on public.inventory_transactions
  for insert with check (
    exists (
      select 1 from public.inventory_items
      where id = inventory_transactions.inventory_item_id
        and profile_id = public.current_shop_profile_id()
        and public.has_active_subscription(profile_id)
    )
  );

-- ------------------------------------------------------------
-- counterparties: previously one `for all` policy covering every
-- operation — split so update/delete become owner-only (they
-- weren't distinguished from read/insert before).
-- ------------------------------------------------------------
drop policy if exists "own counterparties" on public.counterparties;

create policy "read shop counterparties" on public.counterparties
  for select using (public.current_shop_profile_id() = owner_profile_id);

create policy "add shop counterparties" on public.counterparties
  for insert with check (public.current_shop_profile_id() = owner_profile_id);

create policy "owner updates counterparties" on public.counterparties
  for update using (auth.uid() = owner_profile_id);

create policy "owner deletes counterparties" on public.counterparties
  for delete using (auth.uid() = owner_profile_id);

-- ------------------------------------------------------------
-- commodities: a shop's custom commodities should be visible to and
-- addable by the whole shop (owner + secretaries), not just whoever
-- happened to create them.
-- ------------------------------------------------------------
drop policy if exists "read commodities" on public.commodities;
create policy "read commodities" on public.commodities
  for select using (
    auth.role() = 'authenticated'
    and (created_by_profile_id is null or created_by_profile_id = public.current_shop_profile_id())
  );

drop policy if exists "users add own commodities" on public.commodities;
create policy "shop adds own commodities" on public.commodities
  for insert with check (
    created_by_profile_id = public.current_shop_profile_id()
    and public.has_active_subscription(created_by_profile_id)
  );

-- ------------------------------------------------------------
-- subscriptions: read-only either way, but a secretary should be
-- able to see the shop's subscription status too (e.g. the renewal
-- banner) rather than seeing nothing.
-- ------------------------------------------------------------
drop policy if exists "read own subscriptions" on public.subscriptions;
create policy "read shop subscriptions" on public.subscriptions
  for select using (public.current_shop_profile_id() = profile_id);

-- ------------------------------------------------------------
-- manual_payment_requests: a secretary can submit/view a payment
-- claim on the shop's behalf too — paying the subscription bill is
-- routine shop admin, not a data-integrity risk the way editing/
-- deleting ledger or inventory history is.
-- ------------------------------------------------------------
drop policy if exists "own manual payment insert" on public.manual_payment_requests;
create policy "shop manual payment insert" on public.manual_payment_requests
  for insert with check (public.current_shop_profile_id() = profile_id);

drop policy if exists "own manual payment read" on public.manual_payment_requests;
create policy "shop manual payment read" on public.manual_payment_requests
  for select using (public.current_shop_profile_id() = profile_id);

-- ------------------------------------------------------------
-- payment-proofs storage: the app uploads to `${profileId}/...`
-- where profileId is now the SHOP's id (see getShopContext()), not
-- necessarily the uploader's own auth id — so a secretary's upload
-- lands in the shop's folder. These policies need to check shop
-- membership instead of straight auth.uid() equality.
-- ------------------------------------------------------------
drop policy if exists "users upload own payment proof" on storage.objects;
create policy "shop uploads own payment proof" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = public.current_shop_profile_id()::text
  );

drop policy if exists "users read own payment proof" on storage.objects;
create policy "shop reads own payment proof" on storage.objects
  for select using (
    bucket_id = 'payment-proofs'
    and (storage.foldername(name))[1] = public.current_shop_profile_id()::text
  );
