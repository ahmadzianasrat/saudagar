import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { enqueueWrite } from "../../lib/offlineQueue";
import { generateClientId } from "../../lib/uuid";
import { useLanguage } from "../../contexts/LanguageContext";

interface Commodity {
  id: string;
  name_en: string;
  unit: string;
}

interface InventoryItem {
  id: string;
  commodity_id: string;
  quantity: number;
  avg_cost_per_unit: number;
  total_cost: number;
  commodity_name?: string;
  unit?: string;
  todayPrice?: number | null;
}

// Surfaces today's market price against each item's own stock — the
// "price against their own stock" differentiator decided on earlier,
// not just a standalone price list.
export default function InventoryHome() {
  const { formatNumber } = useLanguage();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [commodities, setCommodities] = useState<Commodity[]>([]);
  const [showAddTransaction, setShowAddTransaction] = useState<string | null>(null);
  const [txType, setTxType] = useState<"purchase" | "sale" | "adjustment">("purchase");
  const [txQuantity, setTxQuantity] = useState("");
  const [txUnitCost, setTxUnitCost] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setProfileId(data.user.id);
    });
    supabase.from("commodities").select("id, name_en, unit").then(({ data }) => {
      setCommodities(data ?? []);
    });
  }, []);

  useEffect(() => {
    if (profileId) loadItems();
  }, [profileId]);

  async function loadItems() {
    const { data: inv } = await supabase
      .from("inventory_items")
      .select("id, commodity_id, quantity, avg_cost_per_unit, total_cost, commodities(name_en, unit)")
      .eq("profile_id", profileId);

    const withPrices = await Promise.all(
      (inv ?? []).map(async (row: any) => {
        const { data: priceRow } = await supabase
          .from("prices")
          .select("price")
          .eq("commodity_id", row.commodity_id)
          .order("price_date", { ascending: false })
          .limit(1)
          .maybeSingle();
        return {
          ...row,
          commodity_name: row.commodities?.name_en,
          unit: row.commodities?.unit,
          todayPrice: priceRow?.price ?? null,
        };
      })
    );
    setItems(withPrices);
  }

  async function handleAddTransaction(itemId: string) {
    if (!profileId || !txQuantity) return;
    const clientId = generateClientId();
    const signedQty = txType === "sale" ? -Math.abs(Number(txQuantity)) : Math.abs(Number(txQuantity));

    await enqueueWrite("inventory_transactions", clientId, {
      client_id: clientId,
      inventory_item_id: itemId,
      transaction_type: txType,
      quantity: signedQty,
      unit_cost: txType === "purchase" ? Number(txUnitCost) || null : null,
    });

    // NOTE: recalculating avg_cost_per_unit and quantity on the
    // inventory_items row itself is intentionally NOT done client-side —
    // this should be a Postgres trigger on inventory_transactions insert
    // (weighted average cost calc), so it stays correct even if writes
    // arrive out of order from the offline queue. TODO: write that
    // trigger as a follow-up migration before relying on this in
    // production; for now this only records the transaction.

    setTxQuantity("");
    setTxUnitCost("");
    setShowAddTransaction(null);
  }

  async function addNewCommodityToInventory(commodityId: string) {
    if (!profileId) return;
    const { data, error } = await supabase
      .from("inventory_items")
      .insert({ profile_id: profileId, commodity_id: commodityId, quantity: 0, avg_cost_per_unit: 0 })
      .select()
      .single();
    if (!error && data) loadItems();
  }

  return (
    <div style={{ padding: 16 }}>
      <h2>Inventory</h2>

      {items.map((item) => (
        <div key={item.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <strong>{item.commodity_name}</strong>
            <span>{formatNumber(item.quantity)} {item.unit}</span>
          </div>
          <div style={{ fontSize: 12, color: "#888" }}>
            Avg cost: {formatNumber(item.avg_cost_per_unit)} / {item.unit} · Total: {formatNumber(item.total_cost)}
          </div>
          {item.todayPrice !== null && (
            <div style={{ fontSize: 12, color: "#1e6f5c", marginTop: 4 }}>
              Today's price: {formatNumber(item.todayPrice ?? 0)} — value at market: {formatNumber((item.todayPrice ?? 0) * item.quantity)}
            </div>
          )}
          <button style={{ marginTop: 8 }} onClick={() => setShowAddTransaction(item.id)}>
            + Record purchase/sale
          </button>
          {showAddTransaction === item.id && (
            <div style={{ marginTop: 8, display: "grid", gap: 6 }}>
              <select value={txType} onChange={(e) => setTxType(e.target.value as any)}>
                <option value="purchase">Purchase</option>
                <option value="sale">Sale</option>
                <option value="adjustment">Adjustment</option>
              </select>
              <input placeholder="Quantity" type="number" value={txQuantity} onChange={(e) => setTxQuantity(e.target.value)} />
              {txType === "purchase" && (
                <input placeholder="Unit cost" type="number" value={txUnitCost} onChange={(e) => setTxUnitCost(e.target.value)} />
              )}
              <button onClick={() => handleAddTransaction(item.id)}>Save</button>
            </div>
          )}
        </div>
      ))}

      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 6 }}>Add a commodity to track</div>
        {commodities
          .filter((c) => !items.some((i) => i.commodity_id === c.id))
          .map((c) => (
            <button key={c.id} style={{ marginRight: 6, marginBottom: 6 }} onClick={() => addNewCommodityToInventory(c.id)}>
              + {c.name_en}
            </button>
          ))}
      </div>
    </div>
  );
}
