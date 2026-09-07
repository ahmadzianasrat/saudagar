-- ============================================================
-- inventory_transactions had RLS enabled in 001_initial_schema.sql
-- but was never given a policy — a genuine oversight in the original
-- migration (unlike the earlier admin_users/markets/account_requests
-- issues, which were likely toggled on later via Supabase's advisor).
-- RLS enabled + zero policies denies everything, which is exactly
-- the 403 Forbidden seen when recording a purchase/sale.
--
-- inventory_transactions has no direct profile_id column — ownership
-- is via inventory_item_id -> inventory_items.profile_id, so both
-- policies check through that relationship.
-- ============================================================

drop policy if exists "read own inventory transactions" on public.inventory_transactions;
create policy "read own inventory transactions" on public.inventory_transactions
  for select using (
    exists (
      select 1 from public.inventory_items
      where id = inventory_transactions.inventory_item_id
        and profile_id = auth.uid()
    )
  );

drop policy if exists "write own inventory transactions only if subscribed" on public.inventory_transactions;
create policy "write own inventory transactions only if subscribed" on public.inventory_transactions
  for insert with check (
    exists (
      select 1 from public.inventory_items
      where id = inventory_transactions.inventory_item_id
        and profile_id = auth.uid()
        and public.has_active_subscription(profile_id)
    )
  );
