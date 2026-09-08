-- ============================================================
-- Extends counterparties with two more identity fields, per the
-- request that a contact be identified by more than just name +
-- one number. The existing `phone_number` column is treated as the
-- "mobile number" going forward; whatsapp_number and address are new.
-- All three (beyond name) are optional — not every shop owner will
-- have full details for every customer, especially existing ones
-- added before this change.
--
-- Uses IF NOT EXISTS so this is safe to re-run — a prior attempt may
-- have partially succeeded (e.g. a dropped connection mid-query),
-- and re-running the original non-idempotent version would then fail
-- on "column already exists" for whichever part DID land.
-- ============================================================

alter table public.counterparties
  add column if not exists address text;

alter table public.counterparties
  add column if not exists whatsapp_number text;

comment on column public.counterparties.phone_number is
  'Treated as the mobile number in the UI — kept as phone_number for backward compatibility with existing rows and the wa.me-link code that already reads it.';
