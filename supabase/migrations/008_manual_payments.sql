-- ============================================================
-- Manual subscription payment — for cash-in-hand or mobile top-up
-- payments that don't go through HesabPay. The shop owner submits a
-- claim (tier + note + optional screenshot), an admin reviews and
-- approves/rejects it from the admin panel. Approval creates a real
-- `subscriptions` row, exactly like admin-approve-account does for
-- the trial — this table only tracks the CLAIM, not the entitlement
-- itself.
-- ============================================================

create table public.manual_payment_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  tier text not null check (tier in ('monthly', 'six_month')),
  amount numeric(10,2) not null,
  note text,                          -- e.g. "paid cash to Karim at the shop", "topped up via Roshan"
  proof_image_path text,              -- path within the payment-proofs storage bucket, nullable
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_by uuid references public.admin_users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.manual_payment_requests enable row level security;

-- Shop owners can create their own claim and read their own claims
-- (to see status), but cannot approve themselves or edit after
-- submission — approval only happens via the service-role Edge
-- Function.
create policy "own manual payment insert" on public.manual_payment_requests
  for insert with check (auth.uid() = profile_id);

create policy "own manual payment read" on public.manual_payment_requests
  for select using (auth.uid() = profile_id);

-- Admins with can_approve_accounts can read every pending claim —
-- reusing the same permission as account approval, since it's the
-- same "onboarding/trust" responsibility rather than a separate one.
create policy "admins read manual payments" on public.manual_payment_requests
  for select using (
    exists (
      select 1 from public.admin_users
      where id = auth.uid() and can_approve_accounts = true
    )
  );

-- ------------------------------------------------------------
-- Storage bucket for proof screenshots — private, not public, since
-- these may contain personal payment details.
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', false)
on conflict (id) do nothing;

-- Users can upload/read only within a folder named after their own
-- profile id (the app uploads to `${profileId}/${filename}`).
create policy "users upload own payment proof" on storage.objects
  for insert with check (
    bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users read own payment proof" on storage.objects
  for select using (
    bucket_id = 'payment-proofs' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admins read all payment proofs" on storage.objects
  for select using (
    bucket_id = 'payment-proofs' and exists (
      select 1 from public.admin_users where id = auth.uid() and can_approve_accounts = true
    )
  );
