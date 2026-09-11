-- ============================================================
-- Enables editing inventory transactions correctly. The previous
-- trigger (004/010) only fired AFTER INSERT and updated
-- inventory_items incrementally — editing an existing transaction
-- would NOT have re-triggered any recalculation, silently
-- desyncing the item's quantity/avg_cost from reality.
--
-- Replaced with a trigger that fires on INSERT, UPDATE, or DELETE
-- and recomputes the item's quantity/avg_cost_per_unit from its
-- FULL transaction history in chronological order, every time.
-- More robust than trying to reverse a weighted average
-- incrementally, and correct for edits and (if ever added) deletes.
-- ============================================================

create or replace function public.recompute_inventory_item()
returns trigger as $$
declare
  target_item_id uuid;
  rec record;
  running_qty numeric(12,2) := 0;
  running_avg numeric(12,2) := 0;
  total_prior_value numeric(14,2);
  total_new_value numeric(14,2);
begin
  target_item_id := coalesce(new.inventory_item_id, old.inventory_item_id);

  for rec in
    select * from public.inventory_transactions
    where inventory_item_id = target_item_id
    order by created_at asc
  loop
    if rec.transaction_type = 'purchase' then
      total_prior_value := running_qty * running_avg;
      total_new_value := (rec.quantity * coalesce(rec.unit_cost, 0))
                          + coalesce(rec.transport_cost, 0)
                          + coalesce(rec.porter_fee, 0);
      running_qty := running_qty + rec.quantity;
      if running_qty > 0 then
        running_avg := (total_prior_value + total_new_value) / running_qty;
      end if;
    else
      -- sale (negative quantity) or adjustment (signed quantity) —
      -- cost basis unaffected, only running quantity changes.
      running_qty := running_qty + rec.quantity;
    end if;
  end loop;

  update public.inventory_items
  set quantity = greatest(running_qty, 0),
      avg_cost_per_unit = running_avg,
      updated_at = now()
  where id = target_item_id;

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

drop trigger if exists trg_apply_inventory_transaction on public.inventory_transactions;
drop trigger if exists trg_recompute_inventory_item on public.inventory_transactions;
create trigger trg_recompute_inventory_item
  after insert or update or delete on public.inventory_transactions
  for each row execute function public.recompute_inventory_item();

-- Update policy was missing — needed so an edited transaction can
-- actually be saved (read/insert policies already existed).
drop policy if exists "update own inventory transactions only if subscribed" on public.inventory_transactions;
create policy "update own inventory transactions only if subscribed" on public.inventory_transactions
  for update using (
    exists (
      select 1 from public.inventory_items
      where id = inventory_transactions.inventory_item_id
        and profile_id = auth.uid()
        and public.has_active_subscription(profile_id)
    )
  );

-- Ledger entries already had an update policy from 001 — no change
-- needed there for the ledger-entry edit feature.
