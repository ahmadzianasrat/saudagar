// STUB — reads from the public `prices` table (read-only for all
// authenticated users per the RLS policy already in the schema).
// Multi-market: group by market_id, let the user filter/switch
// between markets even though only one is live at launch — the
// backend already supports multiple `markets` rows from day one.
export default function PricesHome() {
  return (
    <div style={{ padding: 16 }}>
      <p>Prices screen — TODO.</p>
    </div>
  );
}
