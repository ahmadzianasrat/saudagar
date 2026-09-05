-- ============================================================
-- markets and commodities were never given RLS policies in the
-- original schema at all — no enable, no policy. Fine while RLS
-- stayed off, but if Supabase's dashboard advisor prompted enabling
-- RLS on these (same pattern as the admin_users issue fixed earlier),
-- they'd now silently return zero rows to everyone, regardless of
-- actual table contents — which matches "allowed_markets is correct
-- but PriceUploadScreen still says no markets assigned."
-- ============================================================

alter table public.markets enable row level security;

drop policy if exists "authenticated read markets" on public.markets;
create policy "authenticated read markets" on public.markets
  for select using (auth.role() = 'authenticated');

alter table public.commodities enable row level security;

drop policy if exists "authenticated read commodities" on public.commodities;
create policy "authenticated read commodities" on public.commodities
  for select using (auth.role() = 'authenticated');

-- No write policies added — markets/commodities are only ever
-- created/edited via direct SQL for now (there's no in-app UI for
-- adding a new market or commodity yet).
