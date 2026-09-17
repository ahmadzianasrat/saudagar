-- ============================================================
-- Phase 2 (receipts) needs two fields that profiles never had: a
-- shop address and a WhatsApp number distinct from the login phone
-- (phone_number is the login/mobile number; whatsapp_number is
-- optional and may differ, same pattern already used on
-- counterparties). Both nullable — existing shop owners won't have
-- them filled in until they visit the new Shop Profile screen.
-- ============================================================

alter table public.profiles
  add column if not exists address text;

alter table public.profiles
  add column if not exists whatsapp_number text;

comment on column public.profiles.whatsapp_number is
  'Optional — defaults to null (receipts fall back to phone_number) until the owner sets it explicitly in Shop Profile settings.';
