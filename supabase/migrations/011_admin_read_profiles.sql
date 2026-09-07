-- ============================================================
-- profiles previously only allowed a user to read their OWN row.
-- The new "reset a forgotten password" admin flow needs to look up
-- shop owners by name/phone to find the right account — this adds
-- read access for admins (same can_approve_accounts permission used
-- for account approval and manual payments, since it's the same
-- "trusted with user accounts" responsibility) without granting any
-- write access — password changes still only happen via the
-- service-role Edge Function below, never a direct client update.
-- ============================================================

drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select using (
    exists (
      select 1 from public.admin_users
      where id = auth.uid() and can_approve_accounts = true
    )
  );
