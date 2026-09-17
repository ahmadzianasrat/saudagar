-- ============================================================
-- Phase 3: multi-currency (AFN/PKR) support.
--
-- LEDGER DESIGN: a counterparty is assigned ONE currency at creation
-- (matching how these shops actually operate — a customer relationship
-- is entirely in AFN or entirely in PKR, not mixed). Every entry under
-- that counterparty is forced to match it via a trigger, so the app
-- can never accidentally create a mixed-currency account that would
-- make "balance" a meaningless sum of two currencies. Ledger totals
-- are correspondingly kept SEPARATE per currency at the display layer
-- (see LedgerHome.tsx) rather than summed into one number.
--
-- INVENTORY DESIGN: unit_cost/transport_cost/porter_fee on
-- inventory_transactions keep meaning exactly what they always have —
-- the AFN-equivalent cost, which is what avg_cost_per_unit accounting
-- depends on (recompute_inventory_item trigger is UNCHANGED). A
-- purchase/sale entered in PKR gets converted to AFN client-side
-- (using the shop's saved currency-converter rate) before it's
-- written; the ORIGINAL entered amount is recoverable at display time
-- as unit_cost / fx_rate, so nothing about "what currency did I type
-- this in" is lost, without duplicating amount columns.
-- ============================================================

-- --- Counterparties: assigned currency ---
alter table public.counterparties
  add column if not exists currency text not null default 'AFN'
    check (currency in ('AFN', 'PKR'));

-- --- Ledger entries: constrain + lock to the counterparty's currency ---
alter table public.ledger_entries
  drop constraint if exists ledger_entries_currency_check;
alter table public.ledger_entries
  add constraint ledger_entries_currency_check check (currency in ('AFN', 'PKR'));

-- A ledger entry's currency is never chosen by the client — it's
-- always inherited from its counterparty, so a bug (or a future
-- schema client) can't silently create a mixed-currency account.
create or replace function public.lock_ledger_entry_currency()
returns trigger as $$
begin
  select currency into new.currency
  from public.counterparties
  where id = new.counterparty_id;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists lock_ledger_entry_currency on public.ledger_entries;
create trigger lock_ledger_entry_currency
  before insert on public.ledger_entries
  for each row execute function public.lock_ledger_entry_currency();

-- --- Inventory transactions: currency + exchange rate used ---
alter table public.inventory_transactions
  add column if not exists currency text not null default 'AFN'
    check (currency in ('AFN', 'PKR')),
  add column if not exists fx_rate numeric(14, 6) not null default 1
    check (fx_rate > 0);

comment on column public.inventory_transactions.fx_rate is
  'AFN value of 1 unit of `currency` at the time this was recorded. 1 when currency = AFN. unit_cost/transport_cost/porter_fee always store the AFN-equivalent; the originally-entered amount is unit_cost / fx_rate.';
