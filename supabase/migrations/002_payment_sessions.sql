-- ============================================================
-- PAYMENT SESSIONS — tracks a HesabPay checkout attempt from
-- creation through webhook confirmation. Kept separate from
-- `subscriptions` so a subscription row is only ever created
-- once a payment is CONFIRMED, never optimistically.
-- ============================================================

create table public.payment_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tier text not null check (tier in ('monthly', 'six_month')),
  amount numeric(10,2) not null,
  currency text not null default 'AFN',
  -- HesabPay's own session identifier, returned at creation time.
  -- This is what we match the incoming webhook against.
  hesabpay_session_id text unique,
  status text not null default 'pending'
    check (status in ('pending', 'confirmed', 'failed', 'expired')),
  session_url text,               -- the redirect URL we send the user to
  raw_create_response jsonb,      -- full HesabPay response, kept for debugging/audit
  raw_webhook_payload jsonb,      -- full webhook body, kept for debugging/audit
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

alter table public.payment_sessions enable row level security;

create policy "read own payment sessions" on public.payment_sessions
  for select using (auth.uid() = profile_id);

-- Writes to this table happen only via the Edge Functions using the
-- service role key, so no insert/update policy is granted to end users.

create index idx_payment_sessions_profile on public.payment_sessions (profile_id, created_at desc);
create index idx_payment_sessions_hesabpay_id on public.payment_sessions (hesabpay_session_id);
