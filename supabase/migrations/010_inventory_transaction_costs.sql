-- ============================================================
-- Adds transport_cost and porter_fee to inventory_transactions, and
-- updates the weighted-average-cost trigger (from 004_triggers.sql)
-- to fold both into avg_cost_per_unit on a purchase — so "how much
-- it costs me" genuinely reflects the full landed cost, not just the
-- unit price paid to the seller.
-- ============================================================

alter table public.inventory_transactions
  add column transport_cost numeric(12,2) not null default 0,
  add column porter_fee numeric(12,2) not null default 0;

create or replace function public.apply_inventory_transaction()
returns trigger as $$
declare
  current_qty numeric(12,2);
  current_avg_cost numeric(12,2);
  new_qty numeric(12,2);
  new_avg_cost numeric(12,2);
  total_prior_value numeric(14,2);
  total_new_purchase_value numeric(14,2);
begin
  select quantity, avg_cost_per_unit into current_qty, current_avg_cost
  from public.inventory_items
  where id = new.inventory_item_id
  for update;

  if new.transaction_type = 'purchase' then
    new_qty := current_qty + new.quantity;

    -- Fold the goods cost AND transport/porter costs into one pool,
    -- then spread across the new total quantity — this is what makes
    -- avg_cost_per_unit reflect true landed cost, not just the price
    -- paid per unit to the seller.
    total_prior_value := current_qty * current_avg_cost;
    total_new_purchase_value := (new.quantity * coalesce(new.unit_cost, 0))
                                 + coalesce(new.transport_cost, 0)
                                 + coalesce(new.porter_fee, 0);

    if new_qty > 0 then
      new_avg_cost := (total_prior_value + total_new_purchase_value) / new_qty;
    else
      new_avg_cost := current_avg_cost;
    end if;

  elsif new.transaction_type = 'sale' then
    new_qty := current_qty + new.quantity; -- quantity stored negative for sales
    new_avg_cost := current_avg_cost;      -- cost basis unchanged on a sale

  else -- 'adjustment'
    new_qty := current_qty + new.quantity;
    new_avg_cost := current_avg_cost;
  end if;

  update public.inventory_items
  set quantity = greatest(new_qty, 0),
      avg_cost_per_unit = new_avg_cost,
      updated_at = now()
  where id = new.inventory_item_id;

  return new;
end;
$$ language plpgsql security definer;
-- (trigger itself, trg_apply_inventory_transaction, already exists
-- from 004_triggers.sql and points at this function by name — no
-- need to recreate it, replacing the function body is sufficient.)
