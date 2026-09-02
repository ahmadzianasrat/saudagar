// STUB — inventory list + per-item cost basis, wired to
// inventory_items / inventory_transactions tables once auth exists.
// Should surface today's price (from `prices` table) next to each
// item's quantity, per the "price against their own stock" feature
// decided on earlier — this is the differentiator over standalone
// khata/ledger apps, worth prioritizing once the ledger MVP works.
export default function InventoryHome() {
  return (
    <div style={{ padding: 16 }}>
      <p>Inventory screen — TODO.</p>
    </div>
  );
}
