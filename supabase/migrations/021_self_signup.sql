-- ============================================================
-- 021_self_signup.sql
-- ------------------------------------------------------------
-- Supports the new self-serve signup flow (phone + password +
-- confirm password, no admin approval / WhatsApp-relayed password).
--
-- The old flow collected owner_name + shop_name up front on the
-- account_requests row before an admin ever created the profiles
-- row, so profiles.owner_name/shop_name were `not null` with no
-- default. Self-serve signup only collects a phone number and a
-- password at account-creation time — the owner fills in their name
-- and shop name afterwards from Settings -> Shop Profile (already an
-- existing screen). Defaulting both to '' keeps the not-null
-- constraint (nothing downstream has to special-case NULL) while
-- letting the account get created before that data exists.
-- ============================================================

alter table public.profiles
  alter column owner_name set default '',
  alter column shop_name set default '';

comment on column public.profiles.owner_name is
  'May be blank right after self-serve signup — filled in later via Settings -> Shop Profile.';
comment on column public.profiles.shop_name is
  'May be blank right after self-serve signup — filled in later via Settings -> Shop Profile.';
