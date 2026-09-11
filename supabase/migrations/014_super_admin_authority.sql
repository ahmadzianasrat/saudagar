-- ============================================================
-- Super admin should have full authority everywhere WITHOUT needing
-- allowed_markets manually kept in sync as new markets are added, and
-- without needing can_approve_accounts explicitly set. Rather than
-- populating allowed_markets with every market id (which would go
-- stale the moment a new market is added), every policy that checks
-- allowed_markets or can_approve_accounts now also accepts
-- role = 'super_admin' as an automatic bypass.
--
-- Also adds is_active, so a super admin can deactivate another admin
-- from the UI without deleting their row (reversible).
-- ============================================================

alter table public.admin_users
  add column if not exists is_active boolean not null default true;

-- --- Prices: super_admin bypasses allowed_markets entirely ---
drop policy if exists "staff write prices within allowed markets" on public.prices;
create policy "staff write prices within allowed markets" on public.prices
  for insert with check (
    exists (
      select 1 from public.admin_users au
      where au.id = auth.uid()
        and au.is_active = true
        and (au.role = 'super_admin' or prices.market_id = any(au.allowed_markets))
    )
  );

-- --- Account requests: super_admin bypasses can_approve_accounts ---
drop policy if exists "admins read account requests" on public.account_requests;
create policy "admins read account requests" on public.account_requests
  for select using (
    exists (
      select 1 from public.admin_users
      where id = auth.uid() and is_active = true
        and (role = 'super_admin' or can_approve_accounts = true)
    )
  );

-- --- Manual payment requests: same bypass ---
drop policy if exists "admins read manual payments" on public.manual_payment_requests;
create policy "admins read manual payments" on public.manual_payment_requests
  for select using (
    exists (
      select 1 from public.admin_users
      where id = auth.uid() and is_active = true
        and (role = 'super_admin' or can_approve_accounts = true)
    )
  );

-- --- Profiles (admin lookup for password reset): same bypass ---
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.admin_users
      where id = auth.uid() and is_active = true
        and (role = 'super_admin' or can_approve_accounts = true)
    )
  );

-- --- Payment proof storage: same bypass ---
drop policy if exists "admins read all payment proofs" on storage.objects;
create policy "admins read all payment proofs" on storage.objects
  for select using (
    bucket_id = 'payment-proofs' and exists (
      select 1 from public.admin_users
      where id = auth.uid() and is_active = true
        and (role = 'super_admin' or can_approve_accounts = true)
    )
  );

-- --- admin_users itself: a super_admin can read every admin row (to
-- manage them), not just their own. Regular staff still only see
-- their own row (existing "admin reads own row" policy from
-- 005_admin_users_rls.sql stays as-is, this adds an additional path).
drop policy if exists "super admin reads all admins" on public.admin_users;
create policy "super admin reads all admins" on public.admin_users
  for select using (
    exists (
      select 1 from public.admin_users self
      where self.id = auth.uid() and self.role = 'super_admin' and self.is_active = true
    )
  );
