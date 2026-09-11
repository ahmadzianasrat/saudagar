-- ============================================================
-- The "super admin reads all admins" policy from 014 queried
-- admin_users from within a policy ON admin_users — a self-reference
-- that CAN work safely in Postgres (there's a non-recursive base
-- case via "admin reads own row"), but is a known footgun and not
-- worth leaving in place on faith. Replaced with the same safe
-- pattern already used elsewhere in this schema (has_active_subscription):
-- a SECURITY DEFINER function, which bypasses RLS internally for its
-- own query and sidesteps any self-reference risk entirely.
-- ============================================================

create or replace function public.is_active_super_admin(p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.admin_users
    where id = p_user_id and role = 'super_admin' and is_active = true
  );
$$ language sql stable security definer;

drop policy if exists "super admin reads all admins" on public.admin_users;
create policy "super admin reads all admins" on public.admin_users
  for select using ( public.is_active_super_admin(auth.uid()) );
