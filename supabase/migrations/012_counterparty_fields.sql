-- ============================================================
-- Extends counterparties with two more identity fields, per the
-- request that a contact be identified by more than just name +
-- one number. The existing `phone_number` column is treated as the
-- "mobile number" going forward; whatsapp_number and address are new.
-- All three (beyond name) are optional — not every shop owner will
-- have full details for every customer, especially existing ones
-- added before this change.
-- ============================================================

alter table public.counterparties
  add column address text,
  add column whatsapp_number text;

comment on column public.counterparties.phone_number is
  'Treated as the mobile number in the UI — kept as phone_number for backward compatibility with existing rows and the wa.me-link code that already reads it.';
