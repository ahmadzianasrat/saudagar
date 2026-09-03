-- ============================================================
-- Adds a 'trial' tier so the 30-day free trial is a real,
-- enforceable subscriptions row rather than a separate flag.
-- ------------------------------------------------------------
-- Why a subscriptions row and not a profiles.is_trial flag:
-- the existing RLS paywall (has_active_subscription) already
-- checks subscriptions.status = 'active' AND expires_at > now().
-- Modeling trial as a subscriptions row means that function needs
-- ZERO changes — a trial just is a subscription with tier='trial'
-- and amount=0. A flag-on-profiles approach would have required
-- a second code path in every paywall check, which is exactly the
-- kind of duplicated logic that drifts out of sync over time.
-- ============================================================

alter table public.subscriptions
  drop constraint subscriptions_tier_check;

alter table public.subscriptions
  add constraint subscriptions_tier_check
  check (tier in ('trial', 'monthly', 'six_month'));

-- amount must allow 0 for trial (was implicitly >0 via numeric type only,
-- no explicit check existed, but documenting the intent here)
comment on column public.subscriptions.amount is
  'Amount paid for this subscription period. 0 for trial tier.';
