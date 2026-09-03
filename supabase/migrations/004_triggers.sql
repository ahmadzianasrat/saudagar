-- ============================================================
-- Two triggers filling gaps left as TODOs in the app code:
--
-- 1. inventory_transactions currently get recorded but never
--    actually update the parent inventory_items row. Without this,
--    the inventory screen's quantity/avg-cost display would just be
--    whatever was set at item creation (0), regardless of real
--    purchases/sales logged. This trigger keeps inventory_items in
--    sync automatically on every transaction insert, including ones
--    arriving late from the offline queue.
--
-- 2. prices.change_from_previous was left nullable with a "TODO:
--    populate via trigger" comment. This computes it against the
--    most recent prior price_date for the same market+commodity.
-- ============================================================

create or replace function public.apply_inventory_transaction()
returns trigger as $$
declare
  current_qty numeric(12,2);
  current_avg_cost numeric(12,2);
  new_qty numeric(12,2);
  new_avg_cost numeric(12,2);
begin
  select quantity, avg_cost_per_unit into current_qty, current_avg_cost
  from public.inventory_items
  where id = new.inventory_item_id
  for update; -- lock the row to avoid races between concurrent synced writes

  if new.transaction_type = 'purchase' then
    -- Weighted average cost: (existing value + new value) / new total quantity.
    new_qty := current_qty + new.quantity;
    if new_qty > 0 then
      new_avg_cost := ((current_qty * current_avg_cost) + (new.quantity * coalesce(new.unit_cost, 0)))
                       / new_qty;
    else
      new_avg_cost := current_avg_cost;
    end if;

  elsif new.transaction_type = 'sale' then
    -- new.quantity is stored negative for sales (per LedgerHome/InventoryHome
    -- convention) — cost basis (avg_cost_per_unit) doesn't change on a sale,
    -- only quantity decreases.
    new_qty := current_qty + new.quantity; -- adds a negative number
    new_avg_cost := current_avg_cost;

  else -- 'adjustment'
    new_qty := current_qty + new.quantity;
    new_avg_cost := current_avg_cost;
  end if;

  update public.inventory_items
  set quantity = greatest(new_qty, 0), -- guard against going negative from a bad entry
      avg_cost_per_unit = new_avg_cost,
      updated_at = now()
  where id = new.inventory_item_id;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_apply_inventory_transaction
  after insert on public.inventory_transactions
  for each row execute function public.apply_inventory_transaction();

-- ------------------------------------------------------------

create or replace function public.compute_price_change()
returns trigger as $$
declare
  previous_price numeric(12,2);
begin
  select price into previous_price
  from public.prices
  where market_id = new.market_id
    and commodity_id = new.commodity_id
    and price_date < new.price_date
  order by price_date desc
  limit 1;

  if previous_price is not null then
    new.change_from_previous := new.price - previous_price;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_compute_price_change
  before insert on public.prices
  for each row execute function public.compute_price_change();
